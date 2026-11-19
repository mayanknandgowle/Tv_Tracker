export const statuses = {
  delivered: {label: 'Delivered', color: 'mint'},
  active: {label: 'In progress', color: 'violet'},
  review: {label: 'Needs review', color: 'amber'},
};

const products = ['Full Title Search', 'Current Owner', 'Title Update'];
const counties = ['Clark, NV', 'Maricopa, AZ', 'Travis, TX', 'Orange, FL', 'King, WA'];
const cycle = ['delivered', 'active', 'delivered', 'review', 'active', 'delivered', 'delivered', 'active'];
const volume = [5, 7, 4, 8, 6, 11, 5, 8, 12, 7, 14, 10, 15, 11];
const formatDay = new Intl.DateTimeFormat('en-US', {month: 'short', day: 'numeric', timeZone: 'UTC'});

export const days = volume.map((_, index) => formatDay.format(Date.UTC(2026, 10, 3 + index)));
export const sampleOrders = volume.flatMap((count, day) =>
  Array.from({length: count}, (_, index) => ({
    id: `TV-${4200 + day * 20 + index}`,
    date: days[day],
    day,
    product: products[(day + index) % products.length],
    county: counties[(day * 2 + index) % counties.length],
    status: cycle[(day + index) % cycle.length],
  })),
).reverse();
