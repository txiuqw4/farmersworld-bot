import axios from "axios";
import rateLimit from "axios-rate-limit";
import axiosRetry from "axios-retry";

const http = rateLimit(axios.create(), {
    maxRequests: 1000,
    perMilliseconds: 1000,
    maxRPS: 1000,
});

axiosRetry(http, { retries: 3, retryDelay: axiosRetry.exponentialDelay });

export default http;
