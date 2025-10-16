export default function PrivacyPolicy() {
  return (
    <div style={{ 
      maxWidth: '800px', 
      margin: '0 auto', 
      padding: '40px 20px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      lineHeight: 1.6,
      color: '#333'
    }}>
      <h1 style={{ color: '#111827', marginBottom: '20px' }}>Privacy Policy</h1>
      <p style={{ color: '#6b7280', marginBottom: '30px' }}>Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
      
      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ color: '#111827', marginBottom: '15px' }}>Introduction</h2>
        <p>Multi-Location Analytics ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and safeguard information when you use our Shopify application.</p>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ color: '#111827', marginBottom: '15px' }}>Information We Access</h2>
        <p>Our app accesses the following data from your Shopify store:</p>
        <ul style={{ marginLeft: '20px' }}>
          <li><strong>Products:</strong> Product information, variants, SKUs, and pricing</li>
          <li><strong>Inventory:</strong> Stock levels across all locations</li>
          <li><strong>Orders:</strong> Order details, totals, and line items</li>
          <li><strong>Locations:</strong> Store locations and their status</li>
          <li><strong>Analytics:</strong> Sales metrics and performance data</li>
        </ul>
        <p style={{ marginTop: '15px' }}><strong>Important:</strong> We do NOT store personal customer information. All data is processed in real-time and used solely for generating analytics within your admin panel.</p>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ color: '#111827', marginBottom: '15px' }}>How We Use Information</h2>
        <p>The data accessed is used exclusively to:</p>
        <ul style={{ marginLeft: '20px' }}>
          <li>Generate real-time analytics and reports</li>
          <li>Display inventory levels across locations</li>
          <li>Calculate sales metrics and rankings</li>
          <li>Show product performance data</li>
          <li>Provide business insights for multi-location stores</li>
        </ul>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ color: '#111827', marginBottom: '15px' }}>Data Storage and Security</h2>
        <p>Currently, Multi-Location Analytics:</p>
        <ul style={{ marginLeft: '20px' }}>
          <li>Does NOT store any merchant or customer data in external databases</li>
          <li>Processes all data in real-time from Shopify's API</li>
          <li>Uses secure HTTPS connections for all data transfers</li>
          <li>Maintains session data only for authentication purposes</li>
        </ul>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ color: '#111827', marginBottom: '15px' }}>Third-Party Sharing</h2>
        <p>We do NOT share, sell, rent, or trade your data with third parties. Your store data remains confidential and is only accessible within your own Shopify admin panel.</p>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ color: '#111827', marginBottom: '15px' }}>Data Retention</h2>
        <p>Since we don't store data externally, there is no data retention period. All analytics are generated on-demand using your current Shopify data. When you uninstall the app, we no longer have access to your store data.</p>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ color: '#111827', marginBottom: '15px' }}>Your Rights</h2>
        <p>You have the right to:</p>
        <ul style={{ marginLeft: '20px' }}>
          <li>Access the information our app uses (visible in your Shopify admin)</li>
          <li>Request data deletion (by uninstalling the app)</li>
          <li>Opt-out at any time (by uninstalling the app)</li>
          <li>Contact us with any privacy concerns</li>
        </ul>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ color: '#111827', marginBottom: '15px' }}>GDPR Compliance</h2>
        <p>We are committed to GDPR compliance and have implemented:</p>
        <ul style={{ marginLeft: '20px' }}>
          <li>Mandatory GDPR webhooks for data requests and deletion</li>
          <li>Clear data usage policies</li>
          <li>No unnecessary data collection</li>
          <li>Secure data processing practices</li>
        </ul>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ color: '#111827', marginBottom: '15px' }}>Updates to Privacy Policy</h2>
        <p>We may update this privacy policy from time to time. Any changes will be posted on this page with an updated revision date. Continued use of the app after changes constitutes acceptance of the updated policy.</p>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ color: '#111827', marginBottom: '15px' }}>Contact Information</h2>
        <p>For any privacy-related questions or concerns, please contact us at:</p>
        <p style={{ marginLeft: '20px' }}>
          <strong>Email:</strong> support@curetshop.com<br />
          <strong>App Name:</strong> Multi-Location Analytics<br />
          <strong>Developer:</strong> CuretShop Team
        </p>
      </section>

      <section style={{ marginBottom: '30px', padding: '20px', background: '#f3f4f6', borderRadius: '8px' }}>
        <h3 style={{ color: '#111827', marginBottom: '10px' }}>Summary</h3>
        <p style={{ margin: 0 }}>
          Multi-Location Analytics is a read-only analytics app that processes your Shopify data in real-time 
          without storing any information externally. Your data privacy and security are our top priorities.
        </p>
      </section>
    </div>
  );
}