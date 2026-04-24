import envConfig from "./config/envConfig";
import app from "./app";

const PORT = envConfig.PORT;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});