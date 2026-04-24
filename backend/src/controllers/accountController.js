import Account from '../models/Account.js';

const getProfile = async (req, res) => {
    try {
        const account = await Account.findById(req.accountId);
        if (!account) return res.status(404).json({ error: 'Account not found' });
        res.json(account);
    } catch (error) {
        console.error('getProfile error:', error.message);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const updateProfile = async (req, res) => {
    const { firstName, lastName, email } = req.body;

    if (!firstName || !lastName || !email) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    try {
        const existing = await Account.findByEmail(email);
        if (existing && existing.id !== req.accountId) {
            return res.status(409).json({ error: 'Email already in use' });
        }

        const updated = await Account.updateProfile(req.accountId, { firstName, lastName, email });
        if (!updated) return res.status(404).json({ error: 'Account not found' });

        res.json({ message: 'Profile updated successfully' });
    } catch (error) {
        console.error('updateProfile error:', error.message);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const changePassword = async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Both current and new password are required' });
    }

    if (newPassword.length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    try {
        const account = await Account.findById(req.accountId);
        const isMatch = Account.comparePassword(currentPassword, account.password_hash);

        if (!isMatch) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }

        await Account.updatePassword(req.accountId, newPassword);
        res.json({ message: 'Password changed successfully' });
    } catch (error) {
        console.error('changePassword error:', error.message);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const deleteAccount = async (req, res) => {
    try {
        const deleted = await Account.delete(req.accountId);
        if (!deleted) return res.status(404).json({ error: 'Account not found' });
        res.json({ message: 'Account deleted successfully' });
    } catch (error) {
        console.error('deleteAccount error:', error.message);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const getAllAccounts = async (req, res) => {
    try {
        const accounts = await Account.getAll();
        res.json(accounts);
    } catch (error) {
        console.error('getAllAccounts error:', error.message);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export default { getProfile, updateProfile, changePassword, deleteAccount, getAllAccounts };