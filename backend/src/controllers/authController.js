import jwt from 'jsonwebtoken';
import Account from '../models/Account.js';
import envConfig from '../config/envConfig.js';

const generateToken = (id) => {
    return jwt.sign({ id }, envConfig.JWT_SECRET, { expiresIn: '7d' });
};

const register = async (req, res) => {
    const { firstName, lastName, email, password } = req.body;

    if (!firstName || !lastName || !email || !password) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    try {
        const existing = await Account.searchByEmail(email);
        if (existing) {
            return res.status(409).json({ error: 'Email already in use' });
        }

        const id = await Account.create({ firstName, lastName, email, password });
        const token = generateToken(id);

        res.status(201).json({
            message: 'Account created successfully',
            token,
            account: { id, firstName, lastName, email }
        });
    } catch (error) {
        console.error('Register error:', error.message);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const login = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
        const account = await Account.searchByEmail(email);
        if (!account) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const isMatch = Account.comparePassword(password, account.password_hash);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = generateToken(account.id);

        res.json({
            message: 'Login successful',
            token,
            account: {
                id: account.id,
                firstName: account.firstName,
                lastName: account.lastName,
                email: account.email
            }
        });
    } catch (error) {
        console.error('Login error:', error.message);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const me = async (req, res) => {
    try {
        const account = await Account.findById(req.accountId);
        if (!account) {
            return res.status(404).json({ error: 'Account not found' });
        }
        res.json(account);
    } catch (error) {
        console.error('Me error:', error.message);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export default { register, login, me };