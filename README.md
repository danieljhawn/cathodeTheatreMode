# cathodeTheatreMode
an attempt to make the CathodeTV fit the browser window
## How to use
<ol>
  <li>Download the repo and unzip</li>
  <li>Click the puzzle piece in your browser and select "Manage extensions"</li>
  <li>Enable Developer Mode if it's not enabled (upper right corner)</li>
  <li>Click "Load unpacked" and select the folder you unzipped the repo into</li>
  <li>Refresh the Cathode window and you should be good!</li>
</ol>

## How to Add More Sites
Users can extend this to other sites by:

Add domain to manifest.json:

```
"matches": [
  "*://www.cathodetv.com/*",
  "*://your-new-site.com/*"
]
```
Add config to content.js SITE_CONFIGS:
```
'your-new-site.com': {
  containerSelector: null,  // or '.some-container'
  waitForContainer: false,  // true if using containerSelector
}
```
