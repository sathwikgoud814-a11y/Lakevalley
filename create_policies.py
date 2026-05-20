import os

navbar = """  <!-- Navbar -->
  <nav id="navbar" aria-label="Site navigation" style="position: relative; background: var(--surface);">
    <div class="nav__logo">
      <a href="index.html" style="text-decoration: none; display: flex; align-items: center; gap: 0.5rem;">
        <span class="nav__logo-mark">◆</span>
        <span class="nav__logo-text">LAKE VALLEY BOX STADIUM</span>
      </a>
    </div>
  </nav>"""

footer = """  <!-- Footer -->
  <footer id="footer" aria-label="Footer" style="margin-top: auto; padding-top: 4rem;">
    <div class="footer__inner">
      <div class="footer__brand">
        <span class="footer__logo-mark">◆</span>
        <span class="footer__logo-text">LAKE VALLEY BOX STADIUM</span>
      </div>
      <p class="footer__tagline">Book. Play. Repeat.</p>
      
      <div class="footer__links" style="display: flex; gap: 1.5rem; justify-content: center; margin: 1.5rem 0; flex-wrap: wrap;">
        <a href="terms.html" style="color: var(--text-2); font-size: 0.85rem; text-decoration: none;">Terms & Conditions</a>
        <a href="privacy.html" style="color: var(--text-2); font-size: 0.85rem; text-decoration: none;">Privacy Policy</a>
        <a href="refund.html" style="color: var(--text-2); font-size: 0.85rem; text-decoration: none;">No Refund Policy</a>
      </div>

      <p class="footer__tech">
        Technology by <a href="https://flintco.vercel.app" class="footer__tech-link" rel="noopener" target="_blank">Flint Co.</a>
      </p>
      <p class="footer__copy">© 2026 Lake Valley Box Stadium. All rights reserved.</p>
    </div>
  </footer>"""

def create_page(filename, title, content):
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{title} — Lake Valley Box Stadium</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link rel="stylesheet"
    href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,600&family=Inter:wght@300;400;500;600;700&display=swap" />
  <link rel="stylesheet" href="styles.css" />
  <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🏏</text></svg>">
  <style>
    body {{
      display: flex;
      flex-direction: column;
      min-height: 100vh;
    }}
    .policy-content {{
      flex: 1;
      max-width: 800px;
      margin: 4rem auto;
      padding: 0 1.5rem;
      color: var(--text-1);
    }}
    .policy-content h1 {{
      font-family: 'Cormorant Garamond', serif;
      font-size: 2.5rem;
      margin-bottom: 2rem;
      color: var(--text-1);
    }}
    .policy-content h2 {{
      font-family: 'Cormorant Garamond', serif;
      font-size: 1.8rem;
      margin-top: 2rem;
      margin-bottom: 1rem;
      color: var(--text-1);
    }}
    .policy-content p, .policy-content li {{
      font-size: 1.05rem;
      line-height: 1.6;
      color: var(--text-2);
      margin-bottom: 1rem;
    }}
    .policy-content strong {{
      color: var(--text-1);
    }}
    .policy-content ul, .policy-content ol {{
      margin-left: 1.5rem;
      margin-bottom: 1.5rem;
    }}
    .policy-content li {{
      margin-bottom: 0.75rem;
    }}
    html.light .policy-content h1, 
    html.light .policy-content h2, 
    html.light .policy-content strong {{
      color: #0f172a;
    }}
    html.light .policy-content p, 
    html.light .policy-content li {{
      color: #334155;
    }}
  </style>
</head>
<body>
{navbar}
  <main class="policy-content">
{content}
  </main>
{footer}
</body>
</html>
"""
    with open(f"public/{filename}", "w", encoding="utf-8") as f:
        f.write(html)


terms_content = """    <h1>Terms & Conditions</h1>
    <ol>
      <li><strong>Acceptance of Terms</strong><br>By accessing or using Lake Valley Box Stadium website, you acknowledge and agree to comply with these Terms and Conditions.</li>
      <li><strong>User Responsibilities</strong><br>You agree not to engage in any actions that may disrupt, damage, or interfere with the smooth functioning of the website or its services.</li>
      <li><strong>Intellectual Property Rights</strong><br>All content, graphics, and materials featured on this website are the property of Lake Valley Box Stadium and are protected under applicable intellectual property laws.</li>
      <li><strong>Limitation of Liability</strong><br>Lake Valley Box Stadium will not be held responsible for any indirect, incidental, special, or consequential damages that may arise from your use of or access to our website.</li>
      <li><strong>Indemnification</strong><br>By using this website, you agree to indemnify and hold Lake Valley Box Stadium harmless against any claims, damages, liabilities, costs, or expenses arising from your misuse of the site or violation of these Terms.</li>
      <li><strong>Governing Law</strong><br>These Terms and Conditions shall be governed and interpreted in accordance with the laws of India.</li>
    </ol>
    
    <h2>Contact Us</h2>
    <p>If you have any questions, please contact us:</p>
    <ul>
      <li><strong>Address:</strong> Flat/Door/Block No. 22/1/E/1/1/1, Block 22, Road/Street/Lane Himayath Nagar, Village/Town Moinabad, City Rangareddy, District RANGA REDDI, State TELANGANA, Pin 500075</li>
      <li><strong>Contact no:</strong> 7702438350</li>
      <li><strong>Email ID:</strong> zabee.quadri@gmail.com</li>
    </ul>
"""

privacy_content = """    <h1>Privacy Policy</h1>
    <ol>
      <li><strong>Information We Collect</strong><br>When you place an order or subscribe to our newsletter, we may collect details such as your name, email address, contact information, and payment details.</li>
      <li><strong>How We Use Your Information</strong><br>Your information is used to process orders, provide order updates, respond to inquiries, and improve your shopping experience with Lake Valley Box Stadium.</li>
      <li><strong>Cookies</strong><br>We use cookies to personalize content, analyze traffic, and enhance your browsing experience. You can manage or disable cookies through your browser settings if you prefer.</li>
      <li><strong>Data Security</strong><br>We take necessary security measures to protect your personal data against unauthorized access, misuse, or disclosure, both online and offline.</li>
      <li><strong>Third-Party Services</strong><br>To fulfill your orders, certain information may be shared with trusted third-party partners (such as payment gateways and shipping providers). These partners only receive the information needed to complete their specific service.</li>
      <li><strong>Updates to This Policy</strong><br>Lake Valley Box Stadium may update this Privacy Policy from time to time. Any changes will be posted here, and we recommend reviewing this page periodically.</li>
    </ol>
    
    <h2>Contact Us</h2>
    <p>If you have any questions, please contact us:</p>
    <ul>
      <li><strong>Address:</strong> Flat/Door/Block No. 22/1/E/1/1/1, Block 22, Road/Street/Lane Himayath Nagar, Village/Town Moinabad, City Rangareddy, District RANGA REDDI, State TELANGANA, Pin 500075</li>
      <li><strong>Contact no:</strong> 7702438350</li>
      <li><strong>Email ID:</strong> zabee.quadri@gmail.com</li>
    </ul>
"""

refund_content = """    <h1>No Refund Policy</h1>
    <p>As per our company policy, once a service is purchased, it is non-refundable. No refunds will be issued under any circumstances for these offerings.</p>
    
    <h2>Contact Us</h2>
    <p>If you have any questions, please contact us:</p>
    <ul>
      <li><strong>Address:</strong> Flat/Door/Block No. 22/1/E/1/1/1, Block 22, Road/Street/Lane Himayath Nagar, Village/Town Moinabad, City Rangareddy, District RANGA REDDI, State TELANGANA, Pin 500075</li>
      <li><strong>Contact no:</strong> 7702438350</li>
      <li><strong>Email ID:</strong> zabee.quadri@gmail.com</li>
    </ul>
"""

create_page("terms.html", "Terms & Conditions", terms_content)
create_page("privacy.html", "Privacy Policy", privacy_content)
create_page("refund.html", "No Refund Policy", refund_content)

print("Created policy pages successfully.")
