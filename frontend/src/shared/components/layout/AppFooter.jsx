import {
  Building2,
  Clock3,
  Facebook,
  Globe2,
  Handshake,
  Linkedin,
  Mail,
  MapPin,
  Youtube,
} from "lucide-react";

export default function AppFooter() {
  return (
    <footer className="app-footer">
      <div className="app-footer-inner">
        <div className="app-footer-block">
          <div className="rounded-2xl border border-[var(--border)] bg-white p-3 shadow-sm">
            <img
              src="/arms-logo-v2.svg"
              alt="ARMS Logo"
              className="h-20 w-full object-contain"
            />
          </div>
          <p className="mt-2 text-sm text-slate-600">
            Affiliation and Research Management System for transparent,
            accountable, and data-driven academic workflows.
          </p>
          <p className="mt-3 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <Building2 size={13} />
            ARMS Research and Innovation Platform
          </p>
        </div>

        <div className="app-footer-block">
          <p className="app-footer-title app-footer-title-icon">
            <Handshake size={14} />
            Partners
          </p>
          <ul className="app-footer-list">
            <li className="app-footer-list-item">
              ARMS Research Administration Office
            </li>
            <li className="app-footer-list-item">
              College of Human and Computing Innovations
            </li>
            <li className="app-footer-list-item">
              Caraga State University Academic Units
            </li>
          </ul>
        </div>

        <div className="app-footer-block">
          <p className="app-footer-title app-footer-title-icon">
            <Globe2 size={14} />
            Social Media
          </p>
          <div className="flex flex-wrap gap-2">
            <a
              className="app-footer-link"
              href="https://facebook.com"
              target="_blank"
              rel="noreferrer"
            >
              <Facebook size={14} />
              Facebook
            </a>
            <a
              className="app-footer-link"
              href="https://linkedin.com"
              target="_blank"
              rel="noreferrer"
            >
              <Linkedin size={14} />
              LinkedIn
            </a>
            <a
              className="app-footer-link"
              href="https://youtube.com"
              target="_blank"
              rel="noreferrer"
            >
              <Youtube size={14} />
              YouTube
            </a>
          </div>
        </div>

        <div className="app-footer-block">
          <p className="app-footer-title app-footer-title-icon">
            <Mail size={14} />
            Contact Us
          </p>
          <ul className="app-footer-list">
            <li className="app-footer-list-item-inline">
              <MapPin size={14} />
              Office: ARMS Research Administration
            </li>
            <li className="app-footer-list-item-inline">
              <Mail size={14} />
              Support: Account and proposal workflow concerns
            </li>
            <li className="app-footer-list-item-inline">
              <Clock3 size={14} />
              Hours: Monday to Friday, 8:00 AM - 5:00 PM
            </li>
          </ul>
        </div>
      </div>

      <div className="app-footer-bottom">
        <p>&copy; {new Date().getFullYear()} ARMS. All rights reserved.</p>
      </div>
    </footer>
  );
}
