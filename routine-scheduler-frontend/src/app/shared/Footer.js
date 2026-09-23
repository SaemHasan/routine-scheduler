import React, { Component } from 'react';

class Footer extends Component {
  render () {
    return (
      <footer className="footer">
        <div className="d-sm-flex justify-content-center justify-content-sm-between py-2">
          <span className="text-muted text-center text-sm-left d-block d-sm-inline-block">Copyright © <a href="https://cse.buet.ac.bd/" target="_blank" rel="noopener noreferrer">cse.buet.ac.bd </a>2025</span>
          <span className="float-none float-sm-right d-block mt-1 mt-sm-0 text-center">Created by <a href="https://github.com/ahjoy69" target="_blank" rel="noopener noreferrer">Anup</a>,<a href="https://github.com/AfzalHossan-2005021" target="_blank" rel="noopener noreferrer"> Afzal</a> and
<a href="https://github.com/Gold-Dragon01" target="_blank" rel="noopener noreferrer"> Asif</a></span>
        </div>
      </footer> 
    );
  }
}

export default Footer;