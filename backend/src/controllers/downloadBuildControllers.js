const path = require('path');
const fs = require('fs');

exports.downloadBuild = (req, res) => {
    const platform = req.params.platform;
    let fileName = '';

    // Route the parameter to the correct zip file
    if (platform === 'desktop') {
        fileName = 'Windows.zip';
    } else if (platform === 'mobile') {
        fileName = 'Android.zip';
    } else if (platform === 'vr') {
        fileName = 'Quest3.zip';
    } else {
        return res.status(400).send("Invalid platform requested.");
    }

    const filePath = path.join(__dirname, '../../builds/', fileName);

    // Ensure the file exists before trying to stream it
    if (!fs.existsSync(filePath)) {
        return res.status(404).send("Build file not found on the server.");
    }

    // Set headers to force the browser to download the file instead of displaying it
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Type', 'application/zip');

    // Create a read stream and pipe it to the response to prevent memory spikes
    const readStream = fs.createReadStream(filePath);
    readStream.pipe(res);
    
    // Handle streaming errors gracefully
    readStream.on('error', (err) => {
        console.error("Stream error:", err);
        if (!res.headersSent) {
            res.status(500).send("Error streaming the build.");
        }
    });
};