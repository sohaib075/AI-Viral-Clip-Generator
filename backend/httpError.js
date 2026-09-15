// An error whose message is safe to show to API clients, with the HTTP status to send
const httpError = (status, message) => Object.assign(new Error(message), { status });

module.exports = httpError;
