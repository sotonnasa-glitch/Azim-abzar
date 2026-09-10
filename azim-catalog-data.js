// Build the catalog from the checked-in data chunks. The previous gzip blob
// was corrupt, so its asynchronous decoder never populated AZIM_CATALOG.
(()=>{
  const raw=[...(window.AZIM_PART_1||[]),...(window.AZIM_PART_2||[])];
  const classify=value=>{
    const text=String(value||'').toLowerCase();
    if(/بکس|آچار|آلن|جغجغه|ستاره|رینگی/.test(text))return'wrench';
    if(/مولتی|متر|گیج|ترمومتر|تست باتری/.test(text))return'measure';
    if(/بادی|دریل|فرز|اره|کمپرسور/.test(text))return'power';
    if(/ایمنی|عینک|دستکش|ماسک|کلاه/.test(text))return'safety';
    if(/تعمیر|پولوس|سیبک|انژکتور|تایم|صافکاری|جک|کمپرسنج/.test(text))return'workshop';
    return'hand';
  };
  window.AZIM_CATALOG=raw.map((item,index)=>{
    const [name,price,brand,variant]=item;
    const cat=classify(`${name||''} ${brand||''}`);
    return{
      name:`${name||'محصول'}${variant?` ${variant}`:''}`,
      price:Number(price)||0,
      original_price:Number(price)||0,
      cat,
      brand:brand||'بدون برند',
      code:`PDF-${String(index+1).padStart(4,'0')}`
    };
  });
  document.dispatchEvent(new Event('azim-catalog-ready'));
})();
