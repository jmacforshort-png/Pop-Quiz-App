function parseUtcTimestamp(input, fieldName) {
  if (typeof input !== "string") {
    throw new Error(`${fieldName} must be an ISO date-time string.`);
  }

  // Require an explicit UTC offset to avoid ambiguous local-time parsing.
  if (!/(Z|[+-]\d{2}:\d{2})$/.test(input)) {
    throw new Error(`${fieldName} must include a UTC offset.`);
  }

  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${fieldName} must be a valid ISO date-time.`);
  }

  return date;
}

module.exports = {
  parseUtcTimestamp,
};
