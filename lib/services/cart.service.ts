import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { addToCartSchema, updateCartItemSchema } from "@/lib/validators";
import type { AddToCartInput, UpdateCartItemInput } from "@/lib/validators";
import { Decimal } from "@prisma/client/runtime/library";

export class CartService {
  async getCart(customerId: string, organizationId: string) {
    const cart = await prisma.shopCart.findUnique({
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
    });

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

  async getOrCreateCart(customerId: string, organizationId: string) {
    let cart = await prisma.shopCart.findUnique({
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
    });

    if (!cart) {
      cart = await prisma.shopCart.create({
        data: {
          organizationId,
          customerId,
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

  async addItem(customerId: string, organizationId: string, data: AddToCartInput) {
    // Get or create cart
    const cart = await this.getOrCreateCart(customerId, organizationId);

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

    if (variant.product.trackInventory && variant.inventory < data.quantity && !variant.allowBackOrder) {
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
      
      if (variant.product.trackInventory && variant.inventory < newQuantity && !variant.allowBackOrder) {
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

  async updateItemQuantity(cartItemId: string, customerId: string, data: UpdateCartItemInput) {
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

    if (cartItem.cart.customerId !== customerId) {
      throw new Error("Unauthorized");
    }

    // Check inventory
    if (cartItem.variant.product.trackInventory && 
        cartItem.variant.inventory < data.quantity && 
        !cartItem.variant.allowBackOrder) {
      throw new Error("Insufficient inventory");
    }

    const updatedItem = await prisma.shopCartItem.update({
      where: { id: cartItemId },
      data: { quantity: data.quantity },
    });

    revalidatePath(`/organization/${cartItem.variant.product.organizationId}`);
    return updatedItem;
  }

  async removeItem(cartItemId: string, customerId: string) {
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

    if (cartItem.cart.customerId !== customerId) {
      throw new Error("Unauthorized");
    }

    await prisma.shopCartItem.delete({
      where: { id: cartItemId },
    });

    revalidatePath(`/organization/${cartItem.variant.product.organizationId}`);
  }

  async clearCart(customerId: string, organizationId: string) {
    const cart = await prisma.shopCart.findUnique({
      where: {
        organizationId_customerId: { organizationId, customerId },
      },
    });

    if (!cart) {
      throw new Error("Cart not found");
    }

    await prisma.shopCartItem.deleteMany({
      where: { cartId: cart.id },
    });

    revalidatePath(`/organization`);
  }

  async getCartSummary(customerId: string, organizationId: string) {
    const cart = await this.getCart(customerId, organizationId);
    
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

    const deliveryFee = settings?.deliveryRadius ? 5.00 : 0;
    const taxRate = 0.1; // 10% tax

    const subtotal = cart.items.reduce((sum, item) => {
      const price = item.variant.price ?? item.variant.product.basePrice;
      return sum + (price.toNumber() * item.quantity);
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
}

export const cartService = new CartService();
