import envConfig from "../config/envConfig";
import jwt from 'jsonwebtoken';

const generateAccessToken = (user) => {
    const accessToken = jwt.sign({id:user.id,email:user.email},envConfig.JWT_SECRET,{expiresIn:'1000h'});
    const refreshToken = jwt.sign({id : user.id,email : user.email},envConfig.JWT_SECRET,{expiresIn:'90d'})
    return {accessToken,refreshToken};
}

const register = async (req,res) => {
    const {firstName, lastName , email , password } = req.body ;

    const hashPassword = await bcrypt.hash(password , 10);

    const user = await createAccount({firstName, lastName , email , password : hashPassword});
    res.json(user);
}
const login = async (req,res) => {
    const {email , password} = req.body ;
    const manager = await User
}
const logout = async (req,res) => {
    try {
        const {id} = req.user.id ;

    } catch (error) {
        
    }
}