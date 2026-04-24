import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
    service: "gmail", // or outlook / custom SMTP
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

export const sendUrgentEmail = async (to, data) => {
    const mailOptions = {
        from: `"NucleoMind Alerts" <${process.env.EMAIL_USER}>`,
        to,
        subject: "🚨 Urgent Customer Interaction Detected",
        html: `
            <h2>Urgent Interaction Alert</h2>
            <p><strong>Author:</strong> ${data.author}</p>
            <p><strong>Content:</strong> ${data.content}</p>
            <p><strong>Sentiment:</strong> ${data.sentiment}</p>
            <p><strong>Reason:</strong> ${data.reason}</p>
            <p><strong>Suggested Reply:</strong> ${data.reply || "N/A"}</p>
            <p><strong>Link interaction:</strong> ${data.link || "N/A"}</p>
        `
    };

    await transporter.sendMail(mailOptions);
};