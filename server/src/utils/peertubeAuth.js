import axios from "axios";

let accessToken = null;
let tokenExpiration = null;
let isInitialized = false;

const generateAccessToken = async () => {
  try {
    // Get client credentials first
    const clientResponse = await axios.get(
      `${process.env.PEERTUBE_INSTANCE_URL}/api/v1/oauth-clients/local`
    );
    const { client_id, client_secret } = clientResponse.data;

    // Now get the access token using password grant
    const params = new URLSearchParams();
    params.append("client_id", client_id);
    params.append("client_secret", client_secret);
    params.append("grant_type", "password");
    params.append("username", process.env.PEERTUBE_ADMIN_USERNAME);
    params.append("password", process.env.PEERTUBE_ADMIN_PASSWORD);
    params.append("response_type", "code");
    params.append("scope", "manage:users");

    const tokenResponse = await axios.post(
      `${process.env.PEERTUBE_INSTANCE_URL}/api/v1/users/token`,
      params,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    accessToken = tokenResponse.data.access_token;
    tokenExpiration = Date.now() + (tokenResponse.data.expires_in - 60) * 1000;
    return accessToken;
  } catch (error) {
    console.error(
      "Error generating PeerTube access token:",
      error.response?.data || error.message
    );
    throw error;
  }
};

const initializePeerTubeAuth = async () => {
  if (!isInitialized) {
    try {
      await generateAccessToken();
      isInitialized = true;
      console.log("👍 PeerTube authentication initialized successfully");
    } catch (error) {
      console.error("🥲 Failed to initialize PeerTube authentication:", error);
      throw error;
    }
  }
};

const getAccessToken = async () => {
  if (!accessToken || Date.now() >= tokenExpiration) {
    return await generateAccessToken();
  }
  return accessToken;
};

export { getAccessToken, initializePeerTubeAuth };
