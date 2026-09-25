const foodPhotoFallbacks = [
  { match: /hamburg|burger/i, url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=960&q=85' },
  { match: /pollo|chicken/i, url: 'https://images.unsplash.com/photo-1532550907401-a500c9a57435?auto=format&fit=crop&w=960&q=85' },
  { match: /pasta|espagueti|lasagna|lasaña/i, url: 'https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=960&q=85' },
  { match: /limonada|lemon/i, url: 'https://images.unsplash.com/photo-1546173159-315724a31696?auto=format&fit=crop&w=960&q=85' },
  { match: /jugo|mango|juice/i, url: 'https://images.unsplash.com/photo-1546173159-315724a31696?auto=format&fit=crop&w=960&q=85' },
  { match: /cafe|café|coffee/i, url: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=960&q=85' }
];

const defaultFoodPhoto = 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=960&q=85';

export function fallbackProductPhoto(product) {
  return foodPhotoFallbacks.find(entry => entry.match.test(`${product.name} ${product.category}`))?.url || defaultFoodPhoto;
}

export function productPhoto(product) {
  return product.imageUrl || fallbackProductPhoto(product);
}
