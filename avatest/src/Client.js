function search(query, cb) {
  return new Promise( (resolve,reject) => {
    return fetch(`http://localhost:3000/api/org.example.ava.${query}`, {
      accept: "application/json"
    })
      .then(parseJSON)
      .then(data => resolve(data));
  })

}

function create(type, data){
  return new Promise((resolve, reject) => {
    return fetch(`api/${type}`, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      method: 'post',
      body: JSON.stringify(data)
    })
    .then(parseJSON)
    .then(() => resolve())
  })

}

function parseJSON(response) {
  return response.json();
}

const Client = { search, create };
export default Client;
