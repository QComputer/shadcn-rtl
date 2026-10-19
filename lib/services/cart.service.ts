import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import type { AddToCartInput, UpdateCartItemInput } from "@/lib/validators";
import { Decimal } from "@prisma/client/runtime/library";
import { activePublicBusinessCapabilities } from "@/lib/organization-public-home";
import { toMoneyDecimal, toMoneyNumber } from "@/lib/money";
import { supportedLocales } from "@/lib/i18n";
import { buildOrganizationPublicPath } from "@/lib/custom-domain-routing";
import { ApiError } from "@/lib/api-guards";

const cartInclude = {
  items: {
    include: {
      variant: {
        include: {
          product: {
            select: {
              id: true,
              organizationId: true,
              name: true,
              sku: true,
              image: true,
              basePrice: true,
              discountType: true,
              discountValue: true,
            },
          },
          optionValues: { select: { valueText: true, valueNumber: true, valueBoolean: true, definition: { select: { organizationId: true, key: true, label: true, valueType: true, displayUnit: true, isActive: true, scope: true } } } },
        },
      },
    },
  },
} satisfies Prisma.ShopCartInclude;

type NormalizedCartSource = Prisma.ShopCartGetPayload<{ include: typeof cartInclude }>;

function ensureCartOwner(
  cart: { customerId: string | null; sessionId: string | null },
  customerId?: string | null,
  sessionId?: string | null,
) {
  if (cart.customerId) {
    if (!customerId || customerId !== cart.customerId) {
      throw new Error("Unauthorized");
    }
    return;
  }

  if (!sessionId || sessionId !== cart.sessionId) {
    throw new Error("Unauthorized");
  }
}

function normalizeCart(cart: NormalizedCartSource | null) {
  if (!cart) return null;

  let subtotal = new Decimal(0);
  const items = cart.items.map((item) => {
    const basePrice = toMoneyDecimal(item.variant.price ?? item.variant.product.basePrice, "cart item price");
    const discountType = item.variant.product.discountType;
    const discountValue = item.variant.product.discountValue === null
      ? new Decimal(0)
      : toMoneyDecimal(item.variant.product.discountValue, "cart item discount");
    
    // Apply product discount
    let price = basePrice;
    if (discountType === "percentage" && discountValue.gt(0)) {
      price = basePrice.mul(new Decimal(1).sub(Decimal.min(discountValue, 100).div(100)));
    } else if (discountType === "fixed" && discountValue.gt(0)) {
      price = Decimal.max(new Decimal(0), basePrice.sub(discountValue));
    }
    
    subtotal = subtotal.add(price.mul(item.quantity));
    const options = item.variant.optionValues
      .filter((value) => value.definition.organizationId === item.variant.product.organizationId && value.definition.isActive && value.definition.scope === "VARIANT_OPTION")
      .map((value) => ({
        key: value.definition.key, label: value.definition.label, valueType: value.definition.valueType, displayUnit: value.definition.displayUnit,
        value: value.valueText !== null ? value.valueText : value.valueNumber !== null ? Number(value.valueNumber.toString()) : value.valueBoolean,
      }));
    const variant = { ...item.variant };
    Reflect.deleteProperty(variant, "optionValues");
    const product = { ...variant.product };
    Reflect.deleteProperty(product, "organizationId");
    return { ...item, unitPrice: price.toNumber(), variant: { ...variant, product, options } };
  });

  return {
    ...cart,
    items,
    subtotal: subtotal.toNumber(),
    itemCount: items.reduce((sum: number, item: { quantity: number }) => sum + item.quantity, 0),
  };
}

export class CartService {
  async _getCartBySession(organizationSlug: string, sessionId: string) {
    const cart = await prisma.shopCart.findUnique({
      where: {
        organizationSlug_sessionId: { organizationSlug, sessionId },
      },
      include: cartInclude,
    });

    return normalizeCart(cart);
  }

  async _getOrCreateCart(
    organizationSlug: string,
    customerId: string | null,
    sessionId?: string | null,
  ) {
    if (!customerId && !sessionId) {
      throw new Error("customerId or sessionId is required to get/create a shop cart");
    }

    if (customerId) {
      const cart = await prisma.shopCart.upsert({
        where: {
          organizationSlug_customerId: { organizationSlug, customerId },
        },
        update: {
          status: "ACTIVE",
        },
        create: {
          organizationSlug,
          customerId,
          status: "ACTIVE",
        },
        include: cartInclude,
      });
      return normalizeCart(cart);
    }

    if (!sessionId) {
      throw new Error("sessionId is required for guest cart");
    }

    const cart = await prisma.shopCart.upsert({
      where: {
        organizationSlug_sessionId: { organizationSlug, sessionId },
      },
      update: {
        status: "ACTIVE",
      },
      create: {
        organizationSlug,
        sessionId,
        status: "ACTIVE",
      },
      include: cartInclude,
    });

    return normalizeCart(cart);
  }

  async getCart(
    organizationSlug: string,
    customerId: string | null,
    sessionId: string | null,
  ) {
    if (!customerId && !sessionId) {
      throw new Error("customerId or sessionId is required to get a shop cart");
    }

    if (customerId && sessionId) {
      const guestCart = await prisma.shopCart.findUnique({
        where: { organizationSlug_sessionId: { organizationSlug, sessionId } },
        include: { items: true },
      });

      if (guestCart?.items.length) {
        return this.mergeToUserCart(organizationSlug, customerId, sessionId);
      }
    }

    const cart = customerId
      ? await prisma.shopCart.findUnique({
          where: {
            organizationSlug_customerId: { organizationSlug, customerId },
          },
          include: cartInclude,
        })
      : sessionId
        ? await prisma.shopCart.findUnique({
            where: {
              organizationSlug_sessionId: { organizationSlug, sessionId },
            },
            include: cartInclude,
          })
        : null;

    return normalizeCart(cart);
  }

  async addItem(
    organizationSlug: string,
    customerId: string | null,
    sessionId: string | null,
    data: AddToCartInput,
  ) {
    if (!customerId && !sessionId) {
      throw new Error("customerId or sessionId is required to add to cart");
    }

    const variant = await prisma.productVariant.findFirst({
      where: {
        id: data.variantId,
        deletedAt: null,
        product: {
          deletedAt: null,
          isActive: true,
          organization: {
            isActive: true,
          },
        },
      },
      include: {
        product: {
          include: {
            organization: {
              select: {
                slug: true,
                capabilities: { select: { key: true, status: true } },
              },
            },
          },
        },
      },
    });

    if (!variant) {
      throw new Error("Product variant not found");
    }

    if (!activePublicBusinessCapabilities(variant.product.organization.capabilities).includes("SHOP")) {
      throw new Error("Product variant not found");
    }

    const canonicalOrganizationSlug = variant.product.organization.slug;
    if (organizationSlug !== canonicalOrganizationSlug) {
      throw new Error("Product does not belong to this organization");
    }

    const cart = await this._getOrCreateCart(
      canonicalOrganizationSlug,
      customerId,
      sessionId,
    );

    if (!cart) {
      throw new Error("Unable to create cart");
    }

    const existingItem = await prisma.shopCartItem.findFirst({
      where: {
        cartId: cart.id,
        variantId: data.variantId,
      },
    });

    const requestedQuantity = (existingItem?.quantity ?? 0) + data.quantity;

    if (
      variant.product.trackInventory &&
      !variant.allowBackOrder &&
      variant.inventory - variant.reservedQuantity < requestedQuantity
    ) {
      throw new ApiError(409, "Only the currently available stock can be added to the cart.");
    }

    const item = existingItem
      ? await prisma.shopCartItem.update({
          where: { id: existingItem.id },
          data: { quantity: requestedQuantity },
        })
      : await prisma.shopCartItem.create({
          data: {
            cartId: cart.id,
            variantId: data.variantId,
            quantity: data.quantity,
          },
        });

    revalidatePath(`/shop/${canonicalOrganizationSlug}`);
    return item;
  }

  async updateItemQuantity(
    cartItemId: string,
    data: UpdateCartItemInput,
    customerId?: string | null,
    sessionId?: string | null,
    organizationSlug?: string,
  ) {
    const cartItem = await prisma.shopCartItem.findUnique({
      where: { id: cartItemId },
      include: {
        cart: true,
        variant: {
          include: {
            product: {
              include: {
                organization: true,
              },
            },
          },
        },
      },
    });

    if (!cartItem) {
      throw new Error("Cart item not found");
    }

    ensureCartOwner(cartItem.cart, customerId, sessionId);
    if (organizationSlug && cartItem.cart.organizationSlug !== organizationSlug) throw new ApiError(404, "Cart item not found.");

    if (
      cartItem.variant.product.trackInventory &&
      !cartItem.variant.allowBackOrder &&
      cartItem.variant.inventory - cartItem.variant.reservedQuantity < data.quantity
    ) {
      throw new ApiError(409, "Only the currently available stock can be added to the cart.");
    }

    const updatedItem = await prisma.shopCartItem.update({
      where: { id: cartItemId },
      data: { quantity: data.quantity },
    });

    revalidatePath(`/shop/${cartItem.variant.product.organization.slug}`);
    return updatedItem;
  }

  async removeItem(
    cartItemId: string,
    customerId?: string | null,
    sessionId?: string | null,
    organizationSlug?: string,
  ) {
    const cartItem = await prisma.shopCartItem.findUnique({
      where: { id: cartItemId },
      include: {
        cart: true,
        variant: {
          include: {
            product: {
              include: {
                organization: true,
              },
            },
          },
        },
      },
    });

    if (!cartItem) {
      throw new Error("Cart item not found");
    }

    ensureCartOwner(cartItem.cart, customerId, sessionId);
    if (organizationSlug && cartItem.cart.organizationSlug !== organizationSlug) throw new ApiError(404, "Cart item not found.");

    await prisma.shopCartItem.delete({
      where: { id: cartItemId },
    });

    revalidatePath(`/shop/${cartItem.variant.product.organization.slug}`);
  }

  async clearCart(
    organizationSlug: string,
    customerId: string | null,
    sessionId: string | null,
  ) {
    if (!customerId && !sessionId) {
      throw new Error("customerId or sessionId is required to clear cart");
    }

    const cart = customerId
      ? await prisma.shopCart.findUnique({
          where: {
            organizationSlug_customerId: { organizationSlug, customerId },
          },
        })
      : sessionId
        ? await prisma.shopCart.findUnique({
            where: {
              organizationSlug_sessionId: { organizationSlug, sessionId },
            },
          })
        : null;

    if (!cart) {
      return;
    }

    await prisma.shopCartItem.deleteMany({
      where: { cartId: cart.id },
    });

    await prisma.shopCart.update({
      where: { id: cart.id },
      data: { status: "ACTIVE" },
    });

    revalidatePath("/shop");
    for (const locale of supportedLocales) {
      revalidatePath(buildOrganizationPublicPath({ locale, organizationSlug, surface: "shop" }));
    }
  }

  async getCartSummary(
    organizationSlug: string,
    customerId: string | null,
    sessionId: string | null,
  ) {
    const cart = await this.getCart(organizationSlug, customerId, sessionId);

    if (!cart || cart.items.length === 0) {
      return {
        itemCount: 0,
        subtotal: 0,
        deliveryFee: 0,
        tax: 0,
        total: 0,
      };
    }

    const settings = await prisma.organizationSettings.findUnique({
      where: { organizationSlug },
    });

    const deliveryFee = settings?.deliveryFee ?? 0;
    const taxRate = 0;

    const subtotal = cart.items.reduce((sum, item) => {
      const basePrice = toMoneyNumber(item.variant.price ?? item.variant.product.basePrice, "cart summary item price");
      const discountType = item.variant.product.discountType;
      const discountValue = item.variant.product.discountValue === null
        ? 0
        : toMoneyNumber(item.variant.product.discountValue, "cart summary item discount");

      let price = basePrice;
      if (discountType === "percentage" && discountValue > 0) {
        price = basePrice * (1 - discountValue / 100);
      } else if (discountType === "fixed" && discountValue > 0) {
        price = Math.max(0, basePrice - discountValue);
      }

      return sum + price * item.quantity;
    }, 0);

    const tax = subtotal * taxRate;
    const total = subtotal + deliveryFee + tax;

    return {
      itemCount: cart.items.reduce((sum, item) => sum + item.quantity, 0),
      subtotal,
      deliveryFee,
      tax,
      total,
    };
  }

  async mergeToUserCart(
    organizationSlug: string,
    userId: string,
    sessionId: string,
  ) {
    const guestCart = await prisma.shopCart.findUnique({
      where: { organizationSlug_sessionId: { organizationSlug, sessionId } },
      include: {
        items: true,
      },
    });

    const userCart = await this._getOrCreateCart(organizationSlug, userId, null);

    if (!userCart) {
      throw new Error("Unable to create user cart");
    }

    if (guestCart?.items?.length) {
      for (const item of guestCart.items) {
        const variant = await prisma.productVariant.findFirst({
          where: {
            id: item.variantId,
            deletedAt: null,
            product: {
              deletedAt: null,
              isActive: true,
              organization: {
                slug: organizationSlug,
                isActive: true,
              },
            },
          },
          include: {
            product: {
              include: {
                organization: {
                  select: {
                    capabilities: { select: { key: true, status: true } },
                  },
                },
              },
            },
          },
        });

        if (!variant) {
          continue;
        }

        if (!activePublicBusinessCapabilities(variant.product.organization.capabilities).includes("SHOP")) {
          continue;
        }

        const existingItem = await prisma.shopCartItem.findFirst({
          where: {
            cartId: userCart.id,
            variantId: item.variantId,
          },
        });

        const mergedQuantity = (existingItem?.quantity ?? 0) + item.quantity;
        const quantity =
          variant.product.trackInventory && !variant.allowBackOrder
            ? Math.min(mergedQuantity, Math.max(variant.inventory - variant.reservedQuantity, 0))
            : mergedQuantity;

        if (quantity <= 0) {
          continue;
        }

        if (existingItem) {
          await prisma.shopCartItem.update({
            where: { id: existingItem.id },
            data: { quantity },
          });
        } else {
          await prisma.shopCartItem.create({
            data: {
              cartId: userCart.id,
              variantId: item.variantId,
              quantity,
            },
          });
        }
      }

      await prisma.shopCart.delete({
        where: { id: guestCart.id },
      });
    }

    const mergedCart = await prisma.shopCart.findUnique({
      where: { id: userCart.id },
      include: cartInclude,
    });

    return normalizeCart(mergedCart);
  }

  async cleanupExpiredCarts() {
    const now = new Date();

    const expiredCarts = await prisma.shopCart.findMany({
      where: {
        expiresAt: { lt: now },
      },
    });

    for (const cart of expiredCarts) {
      await prisma.shopCart.delete({
        where: { id: cart.id },
      });
    }

    return expiredCarts.length;
  }
}

export const cartService = new CartService();
