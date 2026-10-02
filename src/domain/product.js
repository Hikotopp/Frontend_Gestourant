export function isAvailableForOrder(product) {
  return product.active && product.stock > 0;
}

export function calculateCartTotal(items) {
  return items.reduce((total, item) => total + Number(item.product.price) * item.quantity, 0);
}
