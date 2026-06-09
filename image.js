const FAX_IMAGE_MAX_WIDTH = 600;
const FAX_IMAGE_MIN_WIDTH = 200;
const FAX_IMAGE_MAX_BYTES = 120 * 1024;

function loadImageFromFile(file) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(url);
            resolve(img);
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Kunne ikke laste bildet.'));
        };
        img.src = url;
    });
}

function scaleDimensions(width, height, maxWidth) {
    if (width <= maxWidth) return { width, height };
    const scale = maxWidth / width;
    return { width: maxWidth, height: Math.round(height * scale) };
}

function applyFaxDither(imageData) {
    const { data, width, height } = imageData;
    const gray = new Float32Array(width * height);

    for (let i = 0; i < gray.length; i++) {
        const idx = i * 4;
        gray[i] = data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;
    }

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = y * width + x;
            const old = gray[i];
            const newVal = old < 128 ? 0 : 255;
            const err = old - newVal;

            if (x + 1 < width) gray[i + 1] += err * 7 / 16;
            if (y + 1 < height) {
                if (x > 0) gray[i + width - 1] += err * 3 / 16;
                gray[i + width] += err * 5 / 16;
                if (x + 1 < width) gray[i + width + 1] += err * 1 / 16;
            }

            const idx = i * 4;
            data[idx] = data[idx + 1] = data[idx + 2] = newVal;
            data[idx + 3] = 255;
        }
    }

    return imageData;
}

function canvasToBlob(canvas, type, quality) {
    return new Promise((resolve) => {
        canvas.toBlob((blob) => resolve(blob), type, quality);
    });
}

function renderDitheredCanvas(img, targetWidth) {
    const { width, height } = scaleDimensions(img.naturalWidth, img.naturalHeight, targetWidth);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    const imageData = ctx.getImageData(0, 0, width, height);
    applyFaxDither(imageData);
    ctx.putImageData(imageData, 0, 0);

    return canvas;
}

async function smallestBlobForCanvas(canvas) {
    const candidates = [await canvasToBlob(canvas, 'image/png')];

    for (let quality = 0.8; quality >= 0.2; quality -= 0.1) {
        candidates.push(await canvasToBlob(canvas, 'image/jpeg', quality));
    }

    return candidates
        .filter(Boolean)
        .sort((a, b) => a.size - b.size)[0] || null;
}

async function processFaxImage(file) {
    const img = await loadImageFromFile(file);

    let best = null;

    for (let width = FAX_IMAGE_MAX_WIDTH; width >= FAX_IMAGE_MIN_WIDTH; width -= 100) {
        const canvas = renderDitheredCanvas(img, width);
        const blob = await smallestBlobForCanvas(canvas);
        if (!blob) continue;

        best = blob;
        if (blob.size <= FAX_IMAGE_MAX_BYTES) {
            return blob;
        }
    }

    if (!best) {
        throw new Error('Kunne ikke behandle bildet. Prøv et annet bilde.');
    }

    return best;
}
