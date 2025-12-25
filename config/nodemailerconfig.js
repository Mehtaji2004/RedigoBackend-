const nodemailer = require('nodemailer');

// Create multiple transporter configurations for fallback
const createTransporter = () => {
     // Primary configuration with Gmail service
     const primaryConfig = {
          service: 'gmail',
          auth: {
               user: process.env.EMAIL,
               pass: process.env.EMAIL_PASSWORD 
          },
          tls: {
               rejectUnauthorized: false
          },
          connectionTimeout: 20000,   // 20 seconds
          greetingTimeout: 10000,     // 10 seconds  
          socketTimeout: 20000,       // 20 seconds
     };

     // Fallback configuration with direct SMTP
     const fallbackConfig = {
          host: 'smtp.gmail.com',
          port: 465,
          secure: true,
          auth: {
               user: process.env.EMAIL,
               pass: process.env.EMAIL_PASSWORD 
          },
          tls: {
               rejectUnauthorized: false
          },
          connectionTimeout: 15000,
          greetingTimeout: 8000,
          socketTimeout: 15000,
     };

     return {
          primary: nodemailer.createTransport(primaryConfig),
          fallback: nodemailer.createTransport(fallbackConfig)
     };
};

const transporters = createTransporter();

// Verify transporter with fallback
const verifyTransporter = async () => {
     console.log('🔧 Testing SMTP connections...');
     console.log('📧 Email credentials:', {
          user: process.env.EMAIL ? '✅ Configured' : '❌ Missing',
          pass: process.env.EMAIL_PASSWORD ? '✅ Configured' : '❌ Missing'
     });
     
     // Try primary transporter first
     try {
          console.log('🔄 Testing primary Gmail service...');
          await transporters.primary.verify();
          console.log('✅ Primary SMTP connection successful');
          return 'primary';
     } catch (primaryError) {
          console.log('⚠️ Primary connection failed, trying fallback...');
          
          // Try fallback transporter
          try {
               console.log('🔄 Testing fallback SMTP...');
               await transporters.fallback.verify();
               console.log('✅ Fallback SMTP connection successful');
               return 'fallback';
          } catch (fallbackError) {
               console.error('❌ All SMTP connections failed');
               console.error('Primary error:', primaryError.message);
               console.error('Fallback error:', fallbackError.message);
               return false;
          }
     }
};

// Initialize verification with timeout
let verificationResult = null;
setTimeout(async () => {
     verificationResult = await verifyTransporter();
}, 2000);

async function sendMail(to, subject, otp) {
    return new Promise(async (resolve, reject) => {
        try {
            console.log('📧 Attempting to send email to:', to);
            
            // Skip verification if it's taking too long and try direct sending
            let activeTransporter = transporters.primary;
            
            if (verificationResult === 'fallback') {
                activeTransporter = transporters.fallback;
                console.log('🔄 Using fallback transporter');
            } else if (verificationResult === false) {
                console.log('⚠️ Verification failed, trying anyway with primary...');
            }

            const mailOptions = {
                from: `"Redigo" <${process.env.EMAIL}>`,  
                to: to,
                subject: subject || "Your OTP Code for Redigo",  
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                        <h2 style="color: #0891b2;">Welcome to Redigo! 🚗</h2>
                        
                        <p>Hello User,</p>
                        
                        <p>Thank you for using Redigo!</p>
                        
                        <div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
                            <h3 style="color: #0891b2; margin-top: 0;">Your OTP Code:</h3>
                            <div style="font-size: 32px; font-weight: bold; color: #0f172a; letter-spacing: 5px; font-family: monospace;">
                                ${otp}
                            </div>
                        </div>
                        
                        <p>Please enter this code to verify your email address. This OTP is valid for <strong>5 minutes</strong>.</p>
                        
                        <p style="color: #6b7280; font-size: 14px;">
                            If you did not request this code, please ignore this email.
                        </p>
                        
                        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
                        
                        <p style="color: #6b7280; font-size: 14px;">
                            Best regards,<br>
                            The Redigo Team<br>
                            🚗 Share your ride, share the journey!
                        </p>
                    </div>
                `,
                text: `Hello User,

            Thank you for using Redigo!  

            Your One-Time Password (OTP) is: ${otp}

            Please enter this code to verify your email address. This OTP is valid for 5 minutes.

            If you did not request this code, please ignore this email.

            Best regards,
            The Redigo Team  
            🚗 Share your ride, share the journey!
            `
            };
            
            // Try primary first, then fallback
            try {
                const info = await activeTransporter.sendMail(mailOptions);
                console.log("✅ Email sent successfully via", verificationResult || 'primary');
                console.log("📧 Message ID:", info.messageId);
                resolve(info);
            } catch (primaryError) {
                if (activeTransporter === transporters.primary) {
                    console.log("⚠️ Primary failed, trying fallback...");
                    try {
                        const info = await transporters.fallback.sendMail(mailOptions);
                        console.log("✅ Email sent successfully via fallback");
                        resolve(info);
                    } catch (fallbackError) {
                        console.error("❌ All transporters failed");
                        reject(fallbackError);
                    }
                } else {
                    reject(primaryError);
                }
            }
            
        } catch (error) {
            console.error("❌ Email sending failed:", error.message);
            reject(error);
        }
    });
}

module.exports = {
    sendMail,
    verifyTransporter,
    transporters
};
