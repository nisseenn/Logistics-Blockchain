import React, { Component } from 'react';
import logo from './logo.svg';
import './App.css';
import Client from './Client'

class App extends Component {
  state = {
    endePerson: [],
    admEmployee: [],
  }

  componentWillMount = () => {
      this.getEndePerson()
      this.getAdmEmployee()
    }

    getEndePerson = () => {
  Client.search('EndePerson')
  .then(data => {
    this.setState({
      endePerson: data
    })
  })
}
getAdmEmployee = () => {
  Client.search('AdmEmployee')
  .then(data => {
    this.setState({
      admEmployee: data
    })
  })
}
  render() {
    return (
      <div className="App">
        <div>
          <h3>Private Individual</h3>
          {this.state.endePerson.map((p, i) => (
            <div
              style={{border: '1px solid black'}}
              key={i}>
              <p>Name: {p.name}</p>
              <p>Name: {p.lastName}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }
}

export default App;
