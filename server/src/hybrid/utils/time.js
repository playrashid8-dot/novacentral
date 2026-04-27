export const ONE_HOUR_MS = 60 * 60 * 1000;
export const ONE_DAY_MS = 24 * ONE_HOUR_MS;
export const WITHDRAW_DELAY_MS = 96 * ONE_HOUR_MS;

export const getMonthStart = (value = new Date()) =>
  new Date(value.getFullYear(), value.getMonth(), 1);

export const ensureMonthWindow = (user, now = new Date()) => {
  const monthStart = getMonthStart(now);
  const currentMonth = monthStart.getTime();
  const storedMonth = user?.monthStart ? new Date(user.monthStart).getTime() : null;

  if (storedMonth === currentMonth) {
    return {
      monthStart,
      monthlyWithdrawn: Number(user?.monthlyWithdrawn || 0),
      shouldReset: false,
    };
  }

  return {
    monthStart,
    monthlyWithdrawn: 0,
    shouldReset: true,
  };
};
