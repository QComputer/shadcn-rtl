import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { Decimal } from "@prisma/client/runtime/library";

export class GuestCartService {
  // Get or create a guest cart
  async getCart(sessionId: string, organizationId: string) {
    // Try to find existing cart
    let cart = await prisma.guestCart.findUnique({
      where: { sessionId },
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

    // If cart exists but for different organization, return null
    if (cart && cart.organizationId !== organizationId) {
      return null;
    }

    // If no cart exists, create one
    if (!cart) {
      // Set expiration to 7 days from now
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      cart = await prisma.guestCart.create({
        data: {
          sessionId,
          organizationId,
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

  // Add item to cart
  async addItem(sessionId: string, organizationId: string, data: { variantId: string; quantity: number }) {
    // Get or create cart
    const cart = await this.getCart(sessionId, organizationId);
    
    if (!cart) {
      throw new Error("Could not create cart");
    }

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
    const existingItem = await prisma.guestCartItem.findFirst({
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

      const updatedItem = await prisma.guestCartItem.update({
        where: { id: existingItem.id },
        data: { quantity: newQuantity },
      });

      return updatedItem;
    }

    // Add new item
    const newItem = await prisma.guestCartItem.create({
      data: {
        cartId: cart.id,
        variantId: data.variantId,
        quantity: data.quantity,
      },
    });

    return newItem;
  }

  // Update item quantity
  async updateItemQuantity(cartItemId: string, sessionId: string, quantity: number) {
    // Find the cart item and verify ownership
    const cartItem = await prisma.guestCartItem.findUnique({
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

    if (cartItem.cart.sessionId !== sessionId) {
      throw new Error("Unauthorized");
    }

    // Check inventory
    if (cartItem.variant.product.trackInventory && 
        cartItem.variant.inventory < quantity && 
        !cartItem.variant.allowBackOrder) {
      throw new Error("Insufficient inventory");
    }

    const updatedItem = await prisma.guestCartItem.update({
      where: { id: cartItemId },
      data: { quantity },
    });

    return updatedItem;
  }

  // Remove item from cart
  async removeItem(cartItemId: string, sessionId: string) {
    // Find the cart item and verify ownership
    const cartItem = await prisma.guestCartItem.findUnique({
      where: { id: cartItemId },
      include: {
        cart: true,
      },
    });

    if (!cartItem) {
      throw new Error("Cart item not found");
    }

    if (cartItem.cart.sessionId !== sessionId) {
      throw new Error("Unauthorized");
    }

    await prisma.guestCartItem.delete({
      where: { id: cartItemId },
    });
  }

  // Clear cart
  async clearCart(sessionId: string, organizationId: string) {
    const cart = await prisma.guestCart.findUnique({
      where: { sessionId },
    });

    if (!cart) {
      return;
    }

    if (cart.organizationId !== organizationId) {
      throw new Error("Cart does not belong to this organization");
    }

    await prisma.guestCartItem.deleteMany({
      where: { cartId: cart.id },
    });
  }

  // Get cart summary
  async getCartSummary(sessionId: string, organizationId: string) {
    const cart = await this.getCart(sessionId, organizationId);
    
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

  // Merge guest cart to user cart on login
  async mergeToUserCart(sessionId: string, userId: string, organizationId: string) {
    const guestCart = await prisma.guestCart.findUnique({
      where: { sessionId },
      include: {
        items: true,
      },
    });

    if (!guestCart || guestCart.items.length === 0) {
      return null;
    }

    // Get or create user cart
    let userCart = await prisma.shopCart.findUnique({
      where: {
        organizationId_customerId: { organizationId, customerId: userId },
      },
    });

    if (!userCart) {
      userCart = await prisma.shopCart.create({
        data: {
          organizationId,
          customerId: userId,
          status: "ACTIVE",
        },
      });
    }

    // Merge items
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

    // Delete guest cart
    await prisma.guestCart.delete({
      where: { id: guestCart.id },
    });

    return userCart;
  }

  // Clean up expired carts (can be called by a cron job)
  async cleanupExpiredCarts() {
    const now = new Date();
    
    const expiredCarts = await prisma.guestCart.findMany({
      where: {
        expiresAt: { lt: now },
      },
    });

    for (const cart of expiredCarts) {
      await prisma.guestCart.delete({
        where: { id: cart.id },
      });
    }

    return expiredCarts.length;
  }
}

export const guestCartService = new GuestCartService();
