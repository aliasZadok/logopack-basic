import React from 'react';

const Footer: React.FC = () => (
  <footer style={{
    backgroundColor: 'black',
    color: 'white',
    padding: '20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    letterSpacing: '0rem',
    fontWeight: 'normal',
    bottom: 0,
    left: 0
  }}>
    <div>© 2024 LogoPack. All rights reserved.</div>
    <div>
        Spot an issue? Help us improve! Email&nbsp;
        <a href="mailto:support@logopack.app" style={{color: 'red'}}>
            support@logopack.app
        </a>
    </div>
  </footer>
);

export default Footer;