const WINDOW_MS = 10 * 60 * 1000;

// The input is already in hall priority order. Use pickup time only to
// decide membership, then restore the first member's hall position.
function bundle(cards) {
  const routes = new Map(), output = [];
  for (const [index, card] of cards.entries()) {
    const order = card.rows[0];
    const point = order.category === 'takeout' ? order.pickupPoint : order.station;
    if (card.mine || order.status !== 'waiting' || !['takeout','parcel'].includes(order.category) ||
        order.night || order.destinationType === 'place' || !point || !order.dorm ||
        !Number.isFinite(order.arrivalAt) || order.arrivalAt <= 0) {
      output.push({index, card});
      continue;
    }
    const key = JSON.stringify([order.campusId, order.category, point, order.dorm, order.destinationKey || '']);
    if (!routes.has(key)) routes.set(key, []);
    routes.get(key).push({index, card});
  }
  for (const route of routes.values()) {
    route.sort((a,b) => a.card.minAt - b.card.minAt || String(a.card.key).localeCompare(String(b.card.key)));
    let group;
    for (const entry of route) {
      const card = entry.card;
      if (!group || card.minAt - group.card.minAt > WINDOW_MS) {
        group = {index:entry.index, card:{...card, rows:[...card.rows]}};
        output.push(group);
      } else {
        group.index = Math.min(group.index, entry.index);
        group.card.rows.push(card.rows[0]);
        group.card.maxAt = card.maxAt;
      }
    }
  }
  return output.sort((a,b) => a.index - b.index).map(entry => entry.card);
}

module.exports = {bundle};
