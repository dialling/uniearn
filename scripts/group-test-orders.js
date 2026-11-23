function make(campusId, now = Date.now()) {
  const minute = 60000;
  const first = Math.ceil(now / minute) * minute + 5 * minute;
  const locker = '丰食汇KFC外卖柜';
  const examples = [
    [0, 4, locker], [6, 5, locker], [9, 3, locker],
    [22, 4, locker], [6, 4, '文星水果店门口外卖点']
  ];
  return examples.map(([offset, reward, pickupPoint], index) => ({
    id: 'group-demo-' + (index + 1), category: 'takeout', status: 'waiting',
    campusId, dorm: '文缘 D01', destinationType: 'dorm', station: 'Takeaway pickup',
    pickupPoint, createdAt: now, arrivalAt: first + offset * minute,
    closesAt: first + (offset + 30) * minute, reward, small: 1, big: 0,
    codes: [''], collected: [], note: '测试单 ' + (index + 1)
  }));
}

module.exports = {make};
