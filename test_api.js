fetch('http://localhost:3000/api/sync/assets?since=0')
  .then(res => res.json())
  .then(data => console.log('success:', data.success, 'data length:', data.data?.length))
  .catch(err => console.error(err));
