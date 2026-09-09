// نمونه دادهٔ محصولات — در پروژهٔ واقعی این داده ممکن است از سرور یا فایل JSON بیاید
const products = [
  { id: 1, name: "دریل شارژی مدل X", price: 1200000, image: "https://via.placeholder.com/400x300?text=%D8%AF%D8%B1%DB%8C%D9%84" },
  { id: 2, name: "متر 5 متری", price: 55000, image: "https://via.placeholder.com/400x300?text=%D9%85%D8%AA%D8%B1" },
  { id: 3, name: "پیچ‌گوشتی ست 6 عددی", price: 98000, image: "https://via.placeholder.com/400x300?text=%D9%BE%DB%8C%DA%86" }
];

// فرمت عدد با جداکننده هزارگانه (فارسی)
function fmt(value) {
  return Number(value).toLocaleString("fa-IR");
}

// تابعی که قیمت +20% را محاسبه، مرتب‌سازی و رندر می‌کند
function renderProducts(productsArray) {
  const container = document.getElementById("product-list");
  if (!container) return;
  container.innerHTML = "";

  const processed = productsArray.map(p => ({
    ...p,
    increasedPrice: Math.round(Number(p.price) * 1.20)
  }));

  // مرتب‌سازی نزولی بر اساس قیمت افزایش‌یافته
  processed.sort((a, b) => b.increasedPrice - a.increasedPrice);

  processed.forEach(p => {
    const card = document.createElement("div");
    card.className = "product-card";
    const imgSrc = p.image || "https://via.placeholder.com/400x300?text=%D9%86%D8%A7%D8%AF%D8%A7%D8%B1";
    card.innerHTML = `
      <img src="${imgSrc}" alt="${p.name}" />
      <h3>${p.name}</h3>
      <p class="price">قیمت فعلی: ${fmt(p.price)} تومان</p>
      <p class="price-increased">قیمت با +20%: ${fmt(p.increasedPrice)} تومان</p>
    `;
    container.appendChild(card);
  });
}

// اگر می‌خواهی محصولات از API یا products.json بیایند، جایگزین کن:
// fetch("/api/products").then(r=>r.json()).then(data=>renderProducts(data))

document.addEventListener("DOMContentLoaded", () => renderProducts(products));
