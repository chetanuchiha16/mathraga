export function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseLocalDate(dateString: string) {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function isSameDay(left: string | null, right: string) {
  return left === right;
}

export function isYesterday(dateString: string | null, todayString: string) {
  if (!dateString) return false;

  const yesterday = parseLocalDate(todayString);
  yesterday.setDate(yesterday.getDate() - 1);
  return getLocalDateString(yesterday) === dateString;
}
