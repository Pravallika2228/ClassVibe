import { FaInstagram, FaLinkedin, FaTelegram } from "react-icons/fa";
import "./Footer.css";
function Footer() {
    return (
        <footer>
            <div className="social-links">
                <a href="https://www.instagram.com/YOUR_USERNAME"className="instagram" target="_blank" rel="noopener noreferrer">
                    <FaInstagram />
                </a>
                <a href="https://www.linkedin.com/in/YOUR_PROFILE" className="linkedin" target="_blank" rel="noopener noreferrer">
                    <FaLinkedin/>
                </a>
                <a href="https://t.me/YOUR_TELEGRAM_USERNAME" className="telegram" target="_blank" rel="noopener noreferrer">
                    <FaTelegram/>
                </a>
            </div>
            <p> Built for modern classrooms 🚀</p>
            <p>© ClassVibe. Connecting classrooms worldwide.</p>
      </footer>
    );
}
export default Footer;