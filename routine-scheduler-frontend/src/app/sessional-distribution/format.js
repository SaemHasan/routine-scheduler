// Periods run 8 … 4; anything below 8 is in the afternoon.
export const formatHour = (t) => {
  const h = Number(t);
  if (h === 12) return "12 PM";
  return h >= 8 ? `${h} AM` : `${h} PM`;
};
