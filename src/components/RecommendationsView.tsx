import React from 'react';

const PILLARS = [
  {
    title: '01. Responsible Smartphone Usage & Digital Wellbeing',
    points: [
      'Enable Android Digital Wellbeing app timers on short-video and social media applications to prevent unintentional late-night screen extension.',
      'Configure Focus Mode or Bedtime Mode after 9:30 PM to silence non-essential group notifications and protect sleep quality.',
      'Apply the 20-20-20 rule during extended study or remote work sessions (every 20 minutes, look 20 feet away for 20 seconds).',
      'Separate productive academic/work folders from entertainment apps on the home screen to reduce impulsive context switching.',
    ],
  },
  {
    title: '02. Digital Awareness Across Demographics',
    points: [
      'Organize guided smartphone workshops for senior citizens and homemakers covering font scaling, emergency SOS setup, and trusted news verification.',
      'Encourage students to balance lecture/coding utility with scheduled offline study intervals rather than passive multi-tasking.',
      'Promote fact-checking habits before forwarding health, financial, or civic claims received in community messaging groups.',
      'Support small business owners in separating personal contacts from WhatsApp Business and digital ledger tools.',
    ],
  },
  {
    title: '03. Android Privacy & Permission Hygiene',
    points: [
      'Audit Android Permission Manager quarterly and revoke camera, microphone, location, or contacts access from apps that do not require them.',
      'Select "Only while using the app" or "Ask every time" for location and media permissions whenever prompted.',
      'Keep Android OS security patches and Google Play system updates enabled to close known vulnerabilities.',
      'Use strong biometric + PIN locks and enable Google Find My Device for lost-phone protection and remote wipe capability.',
    ],
  },
  {
    title: '04. Online Safety & Financial Fraud Prevention',
    points: [
      'Activate two-factor authentication (2FA) on primary Google, banking, and messaging accounts using authenticator apps rather than SMS where possible.',
      'Never install third-party APK files sent via messaging links, unknown QR codes, or unsolicited "KYC update" messages.',
      'Verify UPI merchant names and amounts before entering a PIN; remember that receiving money never requires entering a UPI PIN.',
      'Avoid conducting sensitive banking logins over unencrypted public Wi-Fi networks without verified mobile data or VPN protection.',
    ],
  },
];

export const RecommendationsView: React.FC = () => {
  return (
    <div className="space-y-6">
      <section className="theme-surface rounded-lg border p-6 sm:p-8">
        <p className="theme-accent-text text-xs font-semibold tracking-wide">
          Community Service Action Plan · Practical Guidance
        </p>
        <h1 className="theme-heading mt-2 text-2xl font-bold sm:text-3xl">Recommendations</h1>
        <p className="theme-muted mt-2 max-w-3xl text-sm leading-relaxed sm:text-base">
          Based on patterns observed across student, educator, professional, business, homemaker, and senior citizen Android users, these practical guidelines support healthier screen habits and stronger everyday cybersecurity.
        </p>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {PILLARS.map((pillar) => (
          <section key={pillar.title} className="theme-surface rounded-lg border p-6">
            <h2 className="theme-heading text-base font-semibold">{pillar.title}</h2>
            <ul className="theme-muted mt-4 space-y-2.5 text-sm leading-relaxed">
              {pillar.points.map((pt, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="theme-accent-text font-mono text-xs font-semibold pt-0.5 tabular-nums">
                    •
                  </span>
                  <span>{pt}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
};
