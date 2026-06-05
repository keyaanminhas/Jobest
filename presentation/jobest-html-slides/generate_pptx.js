import { chromium } from 'playwright';
import path from 'path';
import pptxgen from 'pptxgenjs';

(async () => {
  console.log('Launching browser to capture slides...');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1600, height: 900 });
  
  const indexHtmlPath = 'file://' + path.resolve('./index.html');
  await page.goto(indexHtmlPath);
  
  // Wait for fonts to load
  await page.evaluate(() => document.fonts.ready);
  
  const slides = await page.$$('.slide');
  console.log(`Found ${slides.length} slides. Capturing screenshots...`);
  
  const imagePaths = [];
  for (let i = 0; i < slides.length; i++) {
    const imgPath = path.resolve(`./assets/slide_capture_${i + 1}.png`);
    await slides[i].screenshot({ path: imgPath });
    console.log(`Captured slide ${i + 1} to ${imgPath}`);
    imagePaths.push(imgPath);
  }
  
  await browser.close();
  
  console.log('Creating PowerPoint presentation...');
  const pptx = new pptxgen();
  pptx.layout = 'LAYOUT_16x9';
  
  for (let i = 0; i < imagePaths.length; i++) {
    const slide = pptx.addSlide();
    slide.addImage({
      path: imagePaths[i],
      x: 0,
      y: 0,
      w: '100%',
      h: '100%'
    });
    console.log(`Added slide ${i + 1} to PowerPoint`);
  }
  
  const pptxPath = path.resolve('./Jobest_Presentation.pptx');
  await pptx.writeFile({ fileName: pptxPath });
  console.log(`Success! PowerPoint saved to ${pptxPath}`);
})();
