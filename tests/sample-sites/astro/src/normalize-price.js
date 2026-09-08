export function normalizePrice(amountInCents, currencyCode) {
  const wholePart = Math.floor(Math.abs(amountInCents) / 100);
  const fractionPart = Math.abs(amountInCents) % 100;
  const sign = amountInCents < 0 ? "-" : "";
  const wholeString = wholePart.toString();
  const groupedDigits = [];
  for (let i = wholeString.length; i > 0; i -= 3) {
    const start = Math.max(0, i - 3);
    groupedDigits.unshift(wholeString.slice(start, i));
  }
  const grouped = groupedDigits.join(",");
  const fractionString = fractionPart.toString().padStart(2, "0");
  const symbol = currencyCode === "EUR" ? "€" : currencyCode === "GBP" ? "£" : "$";
  const formatted = `${sign}${symbol}${grouped}.${fractionString}`;
  const trimmedTrailingZero = formatted.endsWith(".00") ? formatted.slice(0, -3) : formatted;
  return trimmedTrailingZero;
}
