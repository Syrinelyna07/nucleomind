import envConfig from "./config/envConfig.js";
import app from "./app.js";

const PORT = envConfig.PORT;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});