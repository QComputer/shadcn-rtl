import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { addToCartSchema, updateCartItemSchema } from "@/lib/validators";
import type { AddToCartInput, UpdateCartItemInput } from "@/lib/validators";
import { Decimal } from "@prisma/client/runtime/library";
// TODO: Make the service working for both registered and guest customers
export class CartService {
  // Get or create a shop-cart for a guest with sessionId
  async getOrCreateCartBySession(sessionId: string, organizationId: string) {
    //console.log("------------------------------>sessionId", sessionId);
    // Try to find existing cart
    let cart = await prisma.shopCart.findUnique({
      where: { organizationId_sessionId: { organizationId, sessionId } },
      include: {
        items: {
          include: {
            variant: {
              include: {
                product: true,
              },
            },
          },
        },
      },
    });

    //console.log("----------------cart:", cart);
    // If no cart exists, create one
    if (!cart) {
      // Set expiration to 7 days from now
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      cart = await prisma.shopCart.create({
        data: {
          organizationId,
          sessionId,
          status: "ACTIVE",
          expiresAt,
        },
        include: {
          items: {
            include: {
              variant: {
                include: {
                  product: true,
                },
              },
            },
          },
        },
      });
    }

    // Calculate totals
    let subtotal = new Decimal(0);
    for (const item of cart.items) {
      const price = item.variant.price ?? item.variant.product.basePrice;
      subtotal = subtotal.add(price.mul(item.quantity));
    }

    return {
      ...cart,
      subtotal: subtotal.toNumber(),
      itemCount: cart.items.length,
    };
  }

  async getCartBySession(sessionId: string, organizationId: string) {
    // Try to find existing cart
    const cart = await prisma.shopCart.findUnique({
      where: {
        organizationId_sessionId: { organizationId, sessionId },
      },
      include: {
        items: {
          include: {
            variant: {
              include: {
                product: true,
              },
            },
          },
        },
      },
    });

    //console.log("----------------cart:", cart);

    // If no cart exists, return null
    if (!cart) {
      return null;
    }

    // Set expiration to 7 days from now
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    // Calculate totals
    let subtotal = new Decimal(0);
    for (const item of cart.items) {
      const price = item.variant.price ?? item.variant.product.basePrice;
      subtotal = subtotal.add(price.mul(item.quantity));
    }

    return {
      ...cart,
      subtotal: subtotal.toNumber(),
      itemCount: cart.items.length,
    };
  }

  async getCart(
    customerId: string | null,
    organizationId: string,
    sessionId: string | null,
  ) {
    if (!customerId && !sessionId) {
      throw new Error(
        "customerId or/and sessionId needed to get/create a shop-cart",
      );
    }
    //console.log("--------------getCatrt> customerId:", customerId);
    //console.log("--------------getCatrt> organizationId:", organizationId);
    //console.log("--------------getCatrt> sessionId:", sessionId);
    const cart = sessionId
      ? await this.getCartBySession(sessionId, organizationId)
      : customerId
        ? await prisma.shopCart.findUnique({
            where: {
              organizationId_customerId: { organizationId, customerId },
            },
            include: {
              items: {
                include: {
                  variant: {
                    include: {
                      product: true,
                    },
                  },
                },
              },
            },
          })
        : null;

    // If no cart exists, return null
    if (!cart) return null;

    // Calculate totals
    let subtotal = new Decimal(0);
    for (const item of cart.items) {
      const price = item.variant.price ?? item.variant.product.basePrice;
      subtotal = subtotal.add(price.mul(item.quantity));
    }

    return {
      ...cart,
      subtotal: subtotal.toNumber(),
      itemCount: cart.items.length,
    };
  }

  async getOrCreateCart(
    customerId: string | null,
    organizationId: string,
    sessionId: string | null,
  ) {
    //console.log("--------------getOrCreateCart> customerId:", customerId);
    //console.log(  "--------------getOrCreateCart> organizationId:",  organizationId,);
    //console.log("--------------getOrCreateCart> sessionId:", sessionId);
    if (!customerId && !sessionId) {
      throw new Error(
        "customerId or/and sessionId needed to get/create a shop-cart",
      );
    }
    let cart = sessionId
      ? await this.getOrCreateCartBySession(sessionId, organizationId)
      : await prisma.shopCart.findUnique({
          where: {
            organizationId_customerId: {
              organizationId,
              customerId: customerId || "guest-user",
            },
          },
          include: {
            items: {
              include: {
                variant: {
                  include: {
                    product: true,
                  },
                },
              },
            },
          },
        });

    if (!cart) {
      //console.log("------------------------ no Cart found");

      cart = sessionId
        ? await prisma.shopCart.create({
            data: {
              organizationId,
              sessionId,
              status: "ACTIVE",
            },
            include: {
              items: {
                include: {
                  variant: {
                    include: {
                      product: true,
                    },
                  },
                },
              },
            },
          })
        : await prisma.shopCart.create({
            data: {
              organizationId,
              customerId: customerId || "guest-ueser",
              status: "ACTIVE",
            },
            include: {
              items: {
                include: {
                  variant: {
                    include: {
                      product: true,
                    },
                  },
                },
              },
            },
          });
    }

    return cart;
  }

  async addItem(
    customerId: string | null,
    organizationId: string,
    sessionId: string | null,
    data: AddToCartInput,
  ) {
    //console.log("--------------addItem> organizationId:", organizationId);
    //console.log("--------------addItem> customerId:", customerId);
    //console.log("--------------addItem> sessionId:", sessionId);
    if (!customerId && !sessionId) {
      throw new Error(
        "customerId or/and sessionId needed to get/create a shop-cart",
      );
    }
    // Get or create cart
    const cart = await this.getOrCreateCart(
      customerId,
      organizationId,
      sessionId,
    );
    //console.log("--------------addItem> cart:", cart);

    // Check if variant exists and has inventory
    const variant = await prisma.productVariant.findUnique({
      where: { id: data.variantId },
      include: {
        product: {
          include: {
            organization: true,
          },
        },
      },
    });

    if (!variant) {
      throw new Error("Product variant not found");
    }

    if (variant.product.organizationId !== organizationId) {
      throw new Error("Product does not belong to this organization");
    }

    if (
      variant.product.trackInventory &&
      variant.inventory < data.quantity &&
      !variant.allowBackOrder
    ) {
      throw new Error("Insufficient inventory");
    }

    // Check if item already in cart
    const existingItem = await prisma.shopCartItem.findFirst({
      where: {
        cartId: cart.id,
        variantId: data.variantId,
      },
    });

    if (existingItem) {
      // Update quantity
      const newQuantity = existingItem.quantity + data.quantity;

      if (
        variant.product.trackInventory &&
        variant.inventory < newQuantity &&
        !variant.allowBackOrder
      ) {
        throw new Error("Insufficient inventory for requested quantity");
      }

      const updatedItem = await prisma.shopCartItem.update({
        where: { id: existingItem.id },
        data: { quantity: newQuantity },
      });

      revalidatePath(`/organization/${variant.product.organizationId}`);
      return updatedItem;
    }

    // Add new item
    const newItem = await prisma.shopCartItem.create({
      data: {
        cartId: cart.id,
        variantId: data.variantId,
        quantity: data.quantity,
      },
    });

    revalidatePath(`/organization/${variant.product.organizationId}`);
    return newItem;
  }

  async updateItemQuantity(
    cartItemId: string,
    data: UpdateCartItemInput,
    customerId?: string,
    sessionId?: string,
  ) {
    // Find the cart item and verify ownership
    const cartItem = await prisma.shopCartItem.findUnique({
      where: { id: cartItemId },
      include: {
        cart: true,
        variant: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!cartItem) {
      throw new Error("Cart item not found");
    }
    //console.log("--------------updateItemQuantity> sessionId:", sessionId);

    //console.log("--------------updateItemQuantity> cartItem:", cartItem);

    if (!cartItem.cart.customerId) {
      if (!sessionId || sessionId !== cartItem.cart.sessionId) {
        throw new Error("Unauthorized");
      }
    } else {
      if (customerId !== cartItem.cart.customerId) {
        throw new Error("Unauthorized");
      }
    }

    // Check inventory
    if (
      cartItem.variant.product.trackInventory &&
      cartItem.variant.inventory < data.quantity &&
      !cartItem.variant.allowBackOrder
    ) {
      throw new Error("Insufficient inventory");
    }

    const updatedItem = await prisma.shopCartItem.update({
      where: { id: cartItemId },
      data: { quantity: data.quantity },
    });

    revalidatePath(`/organization/${cartItem.variant.product.organizationId}`);
    return updatedItem;
  }

  async removeItem(cartItemId: string, customerId?: string, sessionId?: string) {
    // Find the cart item and verify ownership
    const cartItem = await prisma.shopCartItem.findUnique({
      where: { id: cartItemId },
      include: {
        cart: true,
        variant: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!cartItem) {
      throw new Error("Cart item not found");
    }

    if (!cartItem.cart.customerId) {
      if (!sessionId || sessionId !== cartItem.cart.sessionId) {
        throw new Error("Unauthorized");
      }
    } else {
      if (customerId !== cartItem.cart.customerId) {
        throw new Error("Unauthorized");
      }
    }

    await prisma.shopCartItem.delete({
      where: { id: cartItemId },
    });

    revalidatePath(`/organization/${cartItem.variant.product.organizationId}`);
  }

  async clearCart(
    customerId: string | null,
    organizationId: string,
    sessionId: string | null,
  ) {
    if (!customerId && !sessionId) {
      throw new Error(
        "customerId or/and sessionId needed to get/create a shop-cart",
      );
    }
    const cart = sessionId
      ? await prisma.shopCart.findUnique({
          where: {
            organizationId_sessionId: { organizationId, sessionId },
          },
        })
      : customerId
        ? await prisma.shopCart.findUnique({
            where: {
              organizationId_customerId: { organizationId, customerId },
            },
          })
        : null;

    if (!cart) {
      throw new Error("Cart not found");
    }

    await prisma.shopCartItem.deleteMany({
      where: { cartId: cart.id },
    });

    revalidatePath(`/organization`);
  }

  async getCartSummary(
    customerId: string | null,
    organizationId: string,
    sessionId: string | null,
  ) {
    const cart = await this.getCart(customerId, organizationId, sessionId);
    //console.log("------------getCartSummary> cart:", cart);

    if (!cart || cart.items.length === 0) {
      return {
        itemCount: 0,
        subtotal: 0,
        deliveryFee: 0,
        tax: 0,
        total: 0,
      };
    }

    // Get organization settings for delivery fee
    const settings = await prisma.organizationSettings.findUnique({
      where: { organizationId },
    });

    const deliveryFee = settings?.deliveryRadius ? 5.0 : 0;
    const taxRate = 0.1; // 10% tax

    const subtotal = cart.items.reduce((sum, item) => {
      const price = item.variant.price ?? item.variant.product.basePrice;
      return sum + price.toNumber() * item.quantity;
    }, 0);

    const tax = subtotal * taxRate;
    const total = subtotal + deliveryFee + tax;

    return {
      itemCount: cart.items.length,
      subtotal,
      deliveryFee,
      tax,
      total,
    };
  }

  // Merge guest cart to user cart on login
  async mergeToUserCart(
    sessionId: string,
    userId: string,
    organizationId: string,
  ) {
    //console.log("--------------mergeToUserCart> organizationId:", organizationId);
    //console.log("--------------mergeToUserCart> customerId=userId:", userId);
    //console.log("--------------mergeToUserCart> sessionId:", sessionId);
    const guestCart = await prisma.shopCart.findUnique({
      where: { organizationId_sessionId: { organizationId, sessionId } },
      include: {
        items: true,
      },
    });
    //console.log("--------------mergeToUserCart> guestCart:", guestCart);

    // Get or create user cart
    const userCart = await this.getOrCreateCart(userId, organizationId, null);

    // Merge items
    if (guestCart && guestCart?.items?.length > 0) {
      for (const item of guestCart.items) {
        const existingItem = await prisma.shopCartItem.findFirst({
          where: {
            cartId: userCart.id,
            variantId: item.variantId,
          },
        });

        if (existingItem) {
          await prisma.shopCartItem.update({
            where: { id: existingItem.id },
            data: { quantity: existingItem.quantity + item.quantity },
          });
        } else {
          await prisma.shopCartItem.create({
            data: {
              cartId: userCart.id,
              variantId: item.variantId,
              quantity: item.quantity,
            },
          });
        }
      }
    }

    // Delete guest cart
    guestCart &&
      (await prisma.shopCart.delete({
        where: { id: guestCart.id },
      }));

    return userCart;
  }

  // Clean up expired carts (can be called by a cron job)
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
