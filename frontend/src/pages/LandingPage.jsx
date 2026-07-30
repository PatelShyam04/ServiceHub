import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wrench, Search, Zap, ShieldCheck, Star, Clock,
  CheckCircle2, ChevronDown, ArrowRight, Award, Sparkles,
  Calendar, MessageSquare, DollarSign, Flame, ThumbsUp,
  Droplets, Hammer, Paintbrush, Bug, Tv, LayoutDashboard,
  Users, TrendingUp, BadgeCheck, HeadphonesIcon, MapPin
} from 'lucide-react';
import PageTransition from '../components/PageTransition';
import './LandingPage.css';

// ─── Helpers ────────────────────────────────────────────────
const parseJwt = (token) => {
  try {
    const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(decodeURIComponent(atob(b64).split('').map(c =>
      '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
    ).join('')));
  } catch { return null; }
};

// ─── Fade-in on scroll ──────────────────────────────────────
const FadeUp = ({ children, delay = 0, className = '' }) => (
  <motion.div
    className={className}
    initial={{ opacity: 0, y: 24 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: '-60px' }}
    transition={{ duration: 0.55, delay, ease: [0.16, 1, 0.3, 1] }}
  >
    {children}
  </motion.div>
);

// ─── DATA ────────────────────────────────────────────────────
const CATEGORIES = [
  {
    name: 'Plumbing Services', icon: Droplets,
    desc: 'Pipe leaks, drain cleaning, tap installations, and water heater repair.',
    count: '120+ Pros', color: 'blue'
  },
  {
    name: 'Electrical Work', icon: Zap,
    desc: 'Wiring, circuit breakers, light fixtures, and appliance power setup.',
    count: '95+ Pros', color: 'amber'
  },
  {
    name: 'AC & Appliance Repair', icon: Tv,
    desc: 'Air conditioner servicing, refrigerator & washing machine maintenance.',
    count: '80+ Pros', color: 'sky'
  },
  {
    name: 'Carpentry & Furniture', icon: Hammer,
    desc: 'Furniture assembly, cabinet making, door locks, and wooden repairs.',
    count: '70+ Pros', color: 'orange'
  },
  {
    name: 'Home Painting', icon: Paintbrush,
    desc: 'Interior, exterior, waterproof coatings, and professional touch-ups.',
    count: '65+ Pros', color: 'pink'
  },
  {
    name: 'Pest Control', icon: Bug,
    desc: 'Eco-friendly pest extermination, termite treatment, and sanitization.',
    count: '50+ Pros', color: 'green'
  },
];

const FEATURES = [
  {
    icon: ShieldCheck, box: 'indigo',
    title: 'Background-Checked Pros',
    desc: 'Every provider is vetted with government ID, credentials, and admin review before activation.'
  },
  {
    icon: DollarSign, box: 'emerald',
    title: 'Transparent Pricing',
    desc: 'No hidden fees or surprise charges. Clear invoice breakdowns before job confirmation.'
  },
  {
    icon: MessageSquare, box: 'blue',
    title: 'Real-Time Live Chat',
    desc: 'WebSocket-powered direct messaging between customers and service providers.'
  },
  {
    icon: Clock, box: 'amber',
    title: 'Instant Scheduling',
    desc: 'Book appointments on your schedule or request emergency help in under 15 minutes.'
  },
  {
    icon: ThumbsUp, box: 'rose',
    title: '100% Service Guarantee',
    desc: 'Not satisfied? Our support team will resolve the issue or arrange a free re-visit.'
  },
  {
    icon: Award, box: 'violet',
    title: 'Verified Customer Ratings',
    desc: 'Star ratings left only by customers who completed actual bookings — no fake reviews.'
  },
];

const TESTIMONIALS = [
  {
    name: 'Aarav Sharma', role: 'Homeowner, Mumbai', avatar: 'AS', rating: 5,
    text: 'Found a licensed plumber within 10 minutes when our main pipe burst! Real-time chat and the transparent invoice made the whole experience completely stress-free.'
  },
  {
    name: 'Priya Patel', role: 'Apartment Owner, Bengaluru', avatar: 'PP', rating: 5,
    text: 'ServiceHub is top notch. The technician was background-verified, on time, and fixed our AC cooling issue on the first visit. Highly recommended!'
  },
  {
    name: 'Rohan Verma', role: 'Verified Service Provider', avatar: 'RV', rating: 5,
    text: 'Joining ServiceHub boosted my bookings by 300%. The admin verification process gave my business the credibility it needed to grow faster.'
  },
];

const FAQS = [
  {
    q: 'How does ServiceHub ensure service quality and safety?',
    a: 'All providers undergo rigorous background verification and administrative credential checks before receiving a Verified badge. Our post-service review system also enforces ongoing quality standards.'
  },
  {
    q: 'Can I track my booking in real-time?',
    a: 'Yes! ServiceHub includes real-time booking status tracking (Pending → Accepted → In-Progress → Completed) and built-in live WebSocket chat with your assigned technician.'
  },
  {
    q: 'What if I\'m not satisfied with the service?',
    a: 'We offer a 100% Satisfaction Guarantee. You can dispute or review any completed job, and our 24/7 support team will resolve issues promptly or arrange a free re-visit.'
  },
  {
    q: 'How can service professionals join ServiceHub?',
    a: 'Click "Join as Provider" or sign up selecting the Provider role. Submit your credentials and service categories — our admin team reviews and activates accounts within 24 hours.'
  },
  {
    q: 'Is ServiceHub available in my city?',
    a: 'ServiceHub is currently available across major Indian metros including Mumbai, Delhi, Bengaluru, Pune, Chennai, and Hyderabad. We are expanding rapidly to more cities.'
  },
];

// ─── Main Component ──────────────────────────────────────────
const LandingPage = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFaq, setActiveFaq] = useState(null);
  const [navScrolled, setNavScrolled] = useState(false);

  const token = localStorage.getItem('access');
  const userPayload = token ? parseJwt(token) : null;
  const isLoggedIn = !!token && !!userPayload;

  // Track scroll for navbar shadow
  useEffect(() => {
    const handler = () => setNavScrolled(window.scrollY > 16);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    navigate(isLoggedIn
      ? `/customer?search=${encodeURIComponent(searchQuery)}`
      : `/login?redirect=customer&search=${encodeURIComponent(searchQuery)}`
    );
  };

  const handleCategory = (name) => {
    navigate(isLoggedIn
      ? `/customer?category=${encodeURIComponent(name)}`
      : `/signup?category=${encodeURIComponent(name)}`
    );
  };

  const getDashboardPath = () => {
    if (!userPayload) return '/';
    if (userPayload.is_staff || userPayload.is_superuser) return '/admin';
    const role = localStorage.getItem('active_role');
    if (role === 'provider') return '/provider';
    return '/customer';
  };

  return (
    <PageTransition>
      <div className="landing-container">

        {/* ── Announcement Banner ────────────────────── */}
        <div className="announcement-banner">
          <Sparkles size={14} />
          <span>New: Real-time booking tracker & in-app technician chat now live!</span>
          <Link to="/signup">Sign up free →</Link>
        </div>

        {/* ── Navigation ────────────────────────────── */}
        <nav className={`landing-nav${navScrolled ? ' scrolled' : ''}`}>
          <div className="landing-nav-inner">
            <Link to="/landing" className="brand-logo">
              <div className="brand-icon-wrapper"><Wrench size={20} /></div>
              ServiceHub
            </Link>

            <ul className="nav-links">
              <li><a href="#services"      className="nav-link">Services</a></li>
              <li><a href="#how-it-works"  className="nav-link">How It Works</a></li>
              <li><a href="#why-us"        className="nav-link">Why Us</a></li>
              <li><a href="#testimonials"  className="nav-link">Reviews</a></li>
              <li><a href="#faq"           className="nav-link">FAQ</a></li>
            </ul>

            <div className="nav-actions">
              {isLoggedIn ? (
                <Link to={getDashboardPath()} className="btn-nav-primary">
                  <LayoutDashboard size={15} /> Dashboard
                </Link>
              ) : (
                <>
                  <Link to="/login"  className="btn-nav-ghost">Log In</Link>
                  <Link to="/signup" className="btn-nav-primary">
                    Get Started <ArrowRight size={15} />
                  </Link>
                </>
              )}
            </div>
          </div>
        </nav>

        {/* ── HERO ──────────────────────────────────── */}
        <div className="hero-wrapper">
          <section className="hero-section">

            {/* Left */}
            <motion.div
              initial={{ opacity: 0, x: -28 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="hero-eyebrow">
                <div className="eyebrow-dot" />
                India's #1 On-Demand Home Service Platform
              </div>

              <h1 className="hero-title">
                Trusted Local Experts,{' '}
                <span className="text-gradient">At Your Doorstep</span>
              </h1>

              <p className="hero-subtitle">
                Book verified plumbers, electricians, AC specialists, and repair technicians in minutes. Transparent pricing, real-time tracking, and a 100% satisfaction guarantee.
              </p>

              {/* Search */}
              <form onSubmit={handleSearchSubmit} className="hero-search-box">
                <Search size={18} className="hero-search-icon" />
                <input
                  type="text"
                  placeholder="What service do you need? (e.g. Plumbing, AC Repair)"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="hero-search-input"
                />
                <button type="submit" className="hero-search-btn">
                  Search <ArrowRight size={15} />
                </button>
              </form>

              {/* Quick pills */}
              <div className="hero-pills">
                <span className="pill-label">Popular:</span>
                {['Plumbing', 'Electrical', 'AC Repair', 'Pest Control'].map(p => (
                  <button key={p} type="button" className="hero-pill-btn" onClick={() => handleCategory(p)}>
                    <Flame size={11} style={{ color: '#F59E0B' }} /> {p}
                  </button>
                ))}
              </div>

              {/* Trust row */}
              <div className="hero-trust-row">
                <div className="trust-item">
                  <ShieldCheck size={16} style={{ color: '#059669' }} />
                  Admin-Verified Pros
                </div>
                <div className="trust-divider" />
                <div className="trust-item">
                  <Star size={16} style={{ color: '#F59E0B', fill: '#F59E0B' }} />
                  4.9 / 5 Avg Rating
                </div>
                <div className="trust-divider" />
                <div className="trust-item">
                  <BadgeCheck size={16} style={{ color: '#5B4CF7' }} />
                  25,000+ Jobs Done
                </div>
              </div>
            </motion.div>

            {/* Right: preview card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
              className="hero-visual-container"
            >
              <div className="hero-card-glow" />

              <div className="hero-main-card">
                {/* macOS-style topbar dots */}
                <div className="hero-card-topbar">
                  <div className="topbar-dot red" />
                  <div className="topbar-dot amber" />
                  <div className="topbar-dot green" />
                </div>

                {/* Pro info row */}
                <div className="hero-card-pro-row">
                  <div className="pro-avatar-group">
                    <div className="pro-avatar">RK</div>
                    <div>
                      <p className="pro-name">Rajesh Kumar</p>
                      <p className="pro-role">Master Electrician · 8 yrs exp</p>
                    </div>
                  </div>
                  <div className="status-live">
                    <div className="live-dot" /> Available
                  </div>
                </div>

                {/* Stats pills */}
                <div className="hero-card-stat-row">
                  <div className="stat-pill">
                    <div className="stat-pill-left">
                      <ShieldCheck size={15} style={{ color: '#059669' }} />
                      Admin Verified Provider
                    </div>
                    <div className="stat-pill-right">
                      <Star size={13} style={{ color: '#F59E0B', fill: '#F59E0B', display: 'inline', marginRight: 3 }} />
                      4.9 (142)
                    </div>
                  </div>
                  <div className="stat-pill">
                    <div className="stat-pill-left">
                      <Clock size={15} style={{ color: '#5B4CF7' }} />
                      Avg Response Time
                    </div>
                    <div className="stat-pill-right accent">&lt; 15 minutes</div>
                  </div>
                  <div className="stat-pill">
                    <div className="stat-pill-left">
                      <MapPin size={15} style={{ color: '#E11D48' }} />
                      Service Area
                    </div>
                    <div className="stat-pill-right">Mumbai, Thane</div>
                  </div>
                </div>

                {/* CTA */}
                <button
                  className="hero-card-book-btn"
                  onClick={() => handleCategory('Electrical Work')}
                >
                  Book This Professional <ArrowRight size={15} />
                </button>
              </div>

              {/* Floating badge top-right */}
              <div className="floating-badge floating-badge-1">
                <div className="badge-icon-wrap gold"><Award size={18} /></div>
                <div>
                  <p className="badge-label">100% Guaranteed</p>
                  <p className="badge-sub light">Satisfaction promise</p>
                </div>
              </div>

              {/* Floating badge bottom-left */}
              <div className="floating-badge floating-badge-2">
                <div className="badge-icon-wrap green"><Users size={18} /></div>
                <div>
                  <p className="badge-label" style={{ color: '#FFFFFF' }}>5,000+ Verified Pros</p>
                  <p className="badge-sub">Background screened</p>
                </div>
              </div>
            </motion.div>
          </section>
        </div>

        {/* ── STATS STRIP ───────────────────────────── */}
        <div className="stats-strip">
          <div className="stats-strip-inner">
            {[
              { num: '5,000+', label: 'Verified Professionals' },
              { num: '25,000+', label: 'Completed Bookings' },
              { num: '4.9 / 5', label: 'Average Customer Rating' },
              { num: '99.8%', label: 'On-Time Satisfaction Rate' },
            ].map(s => (
              <div key={s.num} className="stat-block">
                <div className="stat-number">{s.num}</div>
                <div className="stat-label">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── CATEGORIES ────────────────────────────── */}
        <section id="services" className="section-wrapper">
          <div className="section-header">
            <FadeUp>
              <div className="section-eyebrow"><Sparkles size={12} /> Explore Services</div>
              <h2 className="section-title">Popular Home Service Categories</h2>
              <p className="section-subtitle">
                From urgent repairs to planned upgrades — find top-rated professionals for every household need.
              </p>
            </FadeUp>
          </div>

          <div className="categories-grid">
            {CATEGORIES.map((cat, i) => {
              const Icon = cat.icon;
              return (
                <FadeUp key={cat.name} delay={i * 0.07}>
                  <div className="category-card" onClick={() => handleCategory(cat.name)} style={{ cursor: 'pointer' }}>
                    <div className="category-icon-box">
                      <Icon size={26} />
                    </div>
                    <h3>{cat.name}</h3>
                    <p>{cat.desc}</p>
                    <div className="category-footer">
                      <span className="cat-count">
                        <Users size={13} /> {cat.count}
                      </span>
                      <span className="cat-cta">
                        Book Now <ArrowRight size={13} />
                      </span>
                    </div>
                  </div>
                </FadeUp>
              );
            })}
          </div>
        </section>

        {/* ── HOW IT WORKS ──────────────────────────── */}
        <section id="how-it-works" className="how-section">
          <div className="how-inner">
            <div className="section-header">
              <FadeUp>
                <div className="section-eyebrow"><TrendingUp size={12} /> Simple Process</div>
                <h2 className="section-title">Book a Pro in 3 Simple Steps</h2>
                <p className="section-subtitle">
                  From search to service completion — get help at home without any hassle.
                </p>
              </FadeUp>
            </div>

            <div className="steps-grid">
              {[
                {
                  num: '1', icon: Search,
                  title: 'Search & Choose',
                  desc: 'Browse verified service categories, filter by rating, availability, and location — or search by keyword.'
                },
                {
                  num: '2', icon: Calendar,
                  title: 'Confirm Booking',
                  desc: 'Pick a date, describe the problem, attach photos if needed, and receive instant booking confirmation.'
                },
                {
                  num: '3', icon: CheckCircle2,
                  title: 'Track & Pay Safely',
                  desc: 'Chat live with your technician, track job status in real-time, and pay only when the work is done.'
                },
              ].map((step, i) => {
                const Icon = step.icon;
                return (
                  <FadeUp key={step.num} delay={i * 0.1}>
                    <div className="step-item">
                      <div style={{ position: 'relative' }}>
                        <div className="step-icon-ring">
                          <Icon size={28} />
                        </div>
                        <div className="step-number-badge">{step.num}</div>
                      </div>
                      <h3>{step.title}</h3>
                      <p>{step.desc}</p>
                    </div>
                  </FadeUp>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── WHY US ────────────────────────────────── */}
        <section id="why-us" className="section-wrapper">
          <div className="section-header">
            <FadeUp>
              <div className="section-eyebrow"><BadgeCheck size={12} /> Trusted & Reliable</div>
              <h2 className="section-title">Why Thousands Choose ServiceHub</h2>
              <p className="section-subtitle">
                We eliminate guesswork with strict vetting, transparent pricing, and end-to-end customer protection.
              </p>
            </FadeUp>
          </div>

          <div className="features-grid">
            {FEATURES.map((f, i) => {
              const Icon = f.icon;
              return (
                <FadeUp key={f.title} delay={i * 0.07}>
                  <div className="feature-card">
                    <div className={`feature-icon-box ${f.box}`}>
                      <Icon size={22} />
                    </div>
                    <h3>{f.title}</h3>
                    <p>{f.desc}</p>
                  </div>
                </FadeUp>
              );
            })}
          </div>
        </section>

        {/* ── DUAL CTA ──────────────────────────────── */}
        <div className="cta-section">
          <div className="dual-cta-grid">
            <FadeUp>
              <div className="cta-card dark">
                <div className="cta-card-glow" />
                <div className="cta-tag"><HeadphonesIcon size={13} /> For Homeowners</div>
                <h3>Need Expert Home Repair?</h3>
                <p>Get instant access to top-rated plumbers, electricians, cleaners, and technicians near you.</p>
                <Link to={isLoggedIn ? getDashboardPath() : '/signup?role=customer'} className="btn-cta white">
                  Find a Pro Now <ArrowRight size={15} />
                </Link>
              </div>
            </FadeUp>
            <FadeUp delay={0.1}>
              <div className="cta-card primary">
                <div className="cta-card-glow" />
                <div className="cta-tag"><TrendingUp size={13} /> For Professionals</div>
                <h3>Grow Your Service Business</h3>
                <p>Join 5,000+ verified pros on ServiceHub. Get more bookings, manage jobs, and build your reputation.</p>
                <Link to={isLoggedIn ? getDashboardPath() : '/signup?role=provider'} className="btn-cta white">
                  Become a Provider <ArrowRight size={15} />
                </Link>
              </div>
            </FadeUp>
          </div>
        </div>

        {/* ── TESTIMONIALS ──────────────────────────── */}
        <section id="testimonials" className="testimonials-section">
          <div className="testimonials-inner">
            <div className="section-header">
              <FadeUp>
                <div className="section-eyebrow"><Star size={12} /> Customer Reviews</div>
                <h2 className="section-title">What Our Users Say</h2>
                <p className="section-subtitle">
                  Over 25,000 satisfied homeowners and service professionals trust ServiceHub every month.
                </p>
              </FadeUp>
            </div>

            <div className="testimonials-grid">
              {TESTIMONIALS.map((t, i) => (
                <FadeUp key={t.name} delay={i * 0.1}>
                  <div className="testimonial-card">
                    <div>
                      <div className="quote-mark">"</div>
                      <div className="stars-row">
                        {[...Array(t.rating)].map((_, j) => (
                          <Star key={j} size={16} style={{ color: '#F59E0B', fill: '#F59E0B' }} />
                        ))}
                      </div>
                      <p className="testimonial-text">{t.text}</p>
                    </div>
                    <div className="testimonial-author">
                      <div className="author-avatar">{t.avatar}</div>
                      <div>
                        <p className="author-name">{t.name}</p>
                        <p className="author-role">{t.role}</p>
                      </div>
                    </div>
                  </div>
                </FadeUp>
              ))}
            </div>
          </div>
        </section>

        {/* ── FAQ ───────────────────────────────────── */}
        <section id="faq" className="faq-section">
          <div className="faq-grid">
            {/* Sidebar */}
            <FadeUp>
              <div className="faq-sidebar">
                <div className="faq-sidebar-badge"><Sparkles size={12} /> FAQ</div>
                <h2>Frequently Asked Questions</h2>
                <p>
                  Everything you need to know about booking and providing services on ServiceHub. Can't find the answer?
                </p>
                <Link to="/login" className="faq-contact-link">
                  <HeadphonesIcon size={16} /> Contact Support
                </Link>
              </div>
            </FadeUp>

            {/* Accordion */}
            <div className="faq-list">
              {FAQS.map((faq, i) => (
                <FadeUp key={faq.q} delay={i * 0.06}>
                  <div className={`faq-item${activeFaq === i ? ' open' : ''}`}>
                    <button className="faq-question" onClick={() => setActiveFaq(activeFaq === i ? null : i)}>
                      <span>{faq.q}</span>
                      <ChevronDown size={18} className="faq-chevron" />
                    </button>
                    <AnimatePresence initial={false}>
                      {activeFaq === i && (
                        <motion.div
                          className="faq-answer"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                        >
                          <div className="faq-answer-inner">{faq.a}</div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </FadeUp>
              ))}
            </div>
          </div>
        </section>

        {/* ── FOOTER ────────────────────────────────── */}
        <footer className="landing-footer">
          <div className="footer-inner">
            {/* Brand */}
            <div className="footer-brand">
              <Link to="/landing" className="footer-brand-logo">
                <div className="footer-brand-icon"><Wrench size={18} /></div>
                ServiceHub
              </Link>
              <p>
                Connecting households with verified local service professionals for plumbing, electrical, appliances, and maintenance.
              </p>
              <div className="footer-social-row">
                {['Tw', 'Ln', 'Ig', 'Fb'].map(s => (
                  <a key={s} href="#faq" className="social-btn">{s}</a>
                ))}
              </div>
            </div>

            {/* Links */}
            <div className="footer-col">
              <div className="footer-col-title">Company</div>
              <ul>
                <li><a href="#services">Services</a></li>
                <li><a href="#how-it-works">How It Works</a></li>
                <li><a href="#why-us">Why Choose Us</a></li>
                <li><a href="#faq">FAQ</a></li>
              </ul>
            </div>

            <div className="footer-col">
              <div className="footer-col-title">Services</div>
              <ul>
                <li><Link to="/signup?category=Plumbing">Plumbing</Link></li>
                <li><Link to="/signup?category=Electrical">Electrical Work</Link></li>
                <li><Link to="/signup?category=AC Repair">AC & Appliances</Link></li>
                <li><Link to="/signup?category=Painting">Home Painting</Link></li>
                <li><Link to="/signup?category=Pest Control">Pest Control</Link></li>
              </ul>
            </div>

            <div className="footer-col">
              <div className="footer-col-title">Account</div>
              <ul>
                <li><Link to="/login">Log In</Link></li>
                <li><Link to="/signup">Create Account</Link></li>
                <li><Link to="/signup?role=provider">Join as Provider</Link></li>
              </ul>
            </div>
          </div>

          <div className="footer-bottom">
            <div>© {new Date().getFullYear()} ServiceHub Inc. All rights reserved.</div>
            <div className="footer-legal">
              <a href="#faq">Privacy Policy</a>
              <a href="#faq">Terms of Service</a>
              <a href="#faq">Cookie Settings</a>
            </div>
          </div>
        </footer>

      </div>
    </PageTransition>
  );
};

export default LandingPage;
