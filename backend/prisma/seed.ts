// ============================================================
// DesertCart seed script — safe demo data.
// Every demo record is flagged isDemo: true so it can never be
// mistaken for real data (social proof shows a DEMO badge, admin
// dashboards can filter it out).
// Run: npm run db:seed
// ============================================================
import { PrismaClient, OrderStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { DEFAULT_SETTINGS } from '../src/lib/settings';
import { PERMISSIONS, ROLES, rolePermissions } from '../src/lib/rbac';

const prisma = new PrismaClient();

function daysAgo(n: number, hour = 14, min = 30): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, min, 0, 0);
  return d;
}

function hoursFromNow(h: number): Date {
  return new Date(Date.now() + h * 3600 * 1000);
}

const IMG = (name: string) => `/images/products/${name}`;

async function main() {
  console.log('🌱 Seeding DesertCart demo data...');

  // ---- Clean previous demo data (idempotent) ----
  await prisma.cartSession.deleteMany({ where: { customerId: { in: (await prisma.customer.findMany({ where: { isDemo: true }, select: { id: true } })).map((c) => c.id) } } });
  await prisma.order.deleteMany({ where: { isDemo: true } });
  await prisma.review.deleteMany({ where: { isDemo: true } });
  await prisma.couponUsage.deleteMany({});
  await prisma.coupon.deleteMany({ where: { isDemo: true } });
  await prisma.flashSale.deleteMany({ where: { isDemo: true } });
  await prisma.wishlistItem.deleteMany({});
  await prisma.customer.deleteMany({ where: { isDemo: true } });
  await prisma.homepageSection.deleteMany({});
  await prisma.shippingZone.deleteMany({});
  await prisma.shippingRule.deleteMany({});

  // ---- RBAC: permissions + roles ----
  for (const [key, p] of Object.entries(PERMISSIONS)) {
    await prisma.permission.upsert({
      where: { key },
      create: { key, description: p.description, group: p.group },
      update: { description: p.description, group: p.group },
    });
  }
  for (const r of ROLES) {
    await prisma.role.upsert({
      where: { name: r.value },
      create: { name: r.value, description: r.description, permissionKeys: rolePermissions(r.value), isSystem: true },
      update: { description: r.description, permissionKeys: rolePermissions(r.value) },
    });
  }

  // ---- Admin users (DEMO CREDENTIALS — change before production!) ----
  const demoAdmins = [
    { email: 'admin@desertcart.ae', name: 'Demo Super Admin', password: 'Admin@12345', role: 'SUPER_ADMIN' as const },
    { email: 'manager@desertcart.ae', name: 'Demo Manager', password: 'Manager@12345', role: 'MANAGER' as const },
    { email: 'orders@desertcart.ae', name: 'Demo Order Manager', password: 'Orders@12345', role: 'ORDER_MANAGER' as const },
    { email: 'viewer@desertcart.ae', name: 'Demo Viewer', password: 'Viewer@12345', role: 'VIEWER' as const },
  ];
  for (const a of demoAdmins) {
    const hash = await bcrypt.hash(a.password, 12);
    await prisma.adminUser.upsert({
      where: { email: a.email },
      create: { email: a.email, name: a.name, passwordHash: hash, role: a.role, isActive: true },
      update: { name: a.name, role: a.role, isActive: true, deletedAt: null },
    });
  }

  // ---- Store settings ----
  const settingsEntries = Object.entries(DEFAULT_SETTINGS).map(([key, value]) => ({
    key,
    value,
    group: key.split('.')[0],
    isPublic: isPublicKey(key),
  }));
  await prisma.storeSetting.deleteMany({});
  for (const s of settingsEntries) {
    await prisma.storeSetting.create({ data: { key: s.key, value: s.value as never, group: s.group, isPublic: s.isPublic } });
  }

  // ---- Shipping zones + rules ----
  await prisma.shippingZone.createMany({
    data: [
      { name: 'Dubai', emirates: ['DUBAI'], fee: 15, codFee: 0, isActive: true, sortOrder: 1 },
      { name: 'Other Emirates', emirates: ['ABU_DHABI', 'SHARJAH', 'AJMAN', 'UMM_AL_QUWAIN', 'RAS_AL_KHAIMAH', 'FUJAIRAH'], fee: 25, codFee: 0, isActive: true, sortOrder: 2 },
    ],
  });
  await prisma.shippingRule.createMany({
    data: [
      { name: 'Free shipping over AED 199', ruleType: 'FREE_SHIPPING_THRESHOLD', value: 199, isActive: true },
      { name: 'Minimum order', ruleType: 'MIN_ORDER_AMOUNT', value: 0, isActive: true },
      { name: 'Delivery estimate', ruleType: 'DELIVERY_ESTIMATE_DAYS', value: 3, isActive: true },
    ],
  });

  // ---- Categories ----
  const categories = [
    { name: 'Electronics', nameAr: 'الإلكترونيات', slug: 'electronics', image: '/images/categories/electronics.jpg', desc: 'Smart devices and tech essentials', descAr: 'الأجهزة الذكية وأساسيات التقنية', sort: 1 },
    { name: 'Mobile Accessories', nameAr: 'إكسسوارات الجوال', slug: 'mobile-accessories', image: '/images/categories/mobile.jpg', desc: 'Cases, chargers, and more', descAr: 'أغطية وشواحن والمزيد', sort: 2 },
    { name: 'Home & Kitchen', nameAr: 'المنزل والمطبخ', slug: 'home-kitchen', image: '/images/categories/home.jpg', desc: 'Upgrade your everyday living', descAr: 'طوّر حياتك اليومية', sort: 3 },
    { name: 'Beauty & Personal Care', nameAr: 'الجمال والعناية الشخصية', slug: 'beauty', image: '/images/categories/beauty.jpg', desc: 'Self-care essentials', descAr: 'أساسيات العناية الذاتية', sort: 4 },
    { name: 'Car Accessories', nameAr: 'إكسسوارات السيارات', slug: 'car-accessories', image: '/images/categories/car.jpg', desc: 'Keep your ride clean and smart', descAr: 'حافظ على سيارتك نظيفة وذكية', sort: 5 },
    { name: 'Gadgets', nameAr: 'الأجهزة الذكية', slug: 'gadgets', image: '/images/categories/gadgets.jpg', desc: 'Fun, useful, must-have gadgets', descAr: 'أجهزة ممتعة وعملية', sort: 6 },
    { name: 'Lifestyle', nameAr: 'أسلوب الحياة', slug: 'lifestyle', image: '/images/categories/lifestyle.jpg', desc: 'Fashion and daily life upgrades', descAr: 'موضة وتحسينات يومية', sort: 7 },
  ];
  const catIds: Record<string, number> = {};
  for (const c of categories) {
    const created = await prisma.category.upsert({
      where: { slug: c.slug },
      create: { name: c.name, nameAr: c.nameAr, slug: c.slug, imageUrl: c.image, description: c.desc, descriptionAr: c.descAr, sortOrder: c.sort, isActive: true, seoTitle: `${c.name} — DesertCart UAE`, seoDescription: `Shop ${c.name} online in Dubai & UAE with cash on delivery.` },
      update: { name: c.name, nameAr: c.nameAr, imageUrl: c.image, sortOrder: c.sort, isActive: true, deletedAt: null },
    });
    catIds[c.slug] = created.id;
  }

  // ---- Brands (fictional demo brands) ----
  const brands = [
    { name: 'NovaTech', slug: 'novatech' },
    { name: 'UrbanX', slug: 'urbanx' },
    { name: 'HomeGlow', slug: 'homeglow' },
    { name: 'PureLife', slug: 'purelife' },
    { name: 'DrivePro', slug: 'drivepro' },
    { name: 'ZenStyle', slug: 'zenstyle' },
  ];
  const brandIds: Record<string, number> = {};
  for (const b of brands) {
    const created = await prisma.brand.upsert({
      where: { slug: b.slug },
      create: { name: b.name, slug: b.slug, isActive: true },
      update: { name: b.name, isActive: true },
    });
    brandIds[b.slug] = created.id;
  }

  // ---- Products ----
  const productDefs = [
    {
      sku: 'NW-BLEND-01', slug: 'wireless-mini-blender', title: 'Wireless Mini Blender — Portable USB Rechargeable',
      titleAr: 'خلاط مصغّر لاسلكي — قابل للشحن عبر USB',
      price: 129, compareAt: 199, cost: 55, stock: 48, cat: 'home-kitchen', brand: 'HomeGlow',
      featured: true, best: true, recommended: true, discount: 35,
      desc: 'Blend smoothies, shakes and sauces anywhere. 6 stainless steel blades, 380ml BPA-free cup, USB-C fast charging. Perfect for home, office and travel.',
      descAr: 'اخلط العصائر والمخفوقات والصلصات في أي مكان. 6 شفرات من الستانلس ستيل، كوب 380 مل خالٍ من BPA، شحن سريع USB-C. مثالي للمنزل والمكتب والسفر.',
      images: [IMG('blender.jpg')], tags: ['kitchen', 'blender', 'new'],
      specs: [{ label: 'Capacity', value: '380 ml' }, { label: 'Battery', value: '2000 mAh' }, { label: 'Charging', value: 'USB-C' }, { label: 'Warranty', value: '12 months' }],
      weight: 0.6, dims: '10 x 10 x 24 cm', shipNote: 'Ships within 24 hours', sold: 214,
    },
    {
      sku: 'NW-WATCH-02', slug: 'smart-watch-fitness', title: 'Smart Watch Fitness Tracker — 1.85" HD, Bluetooth Call',
      titleAr: 'ساعة ذكية لمتابعة اللياقة — شاشة 1.85 بوصة واتصال بلوتوث',
      price: 149, compareAt: 249, cost: 70, stock: 64, cat: 'electronics', brand: 'NovaTech',
      featured: true, best: true, recommended: true, discount: 40,
      desc: '1.85" HD display, heart-rate & SpO2 monitoring, 100+ sport modes, Bluetooth calling, 7-day battery. IP68 water resistant. Works with Android & iOS.',
      descAr: 'شاشة 1.85 بوصة عالية الدقة، مراقبة معدل ضربات القلب والأكسجين، أكثر من 100 وضع رياضي، اتصال بلوتوث، بطارية 7 أيام. مقاومة للماء IP68.',
      images: [IMG('smartwatch.jpg')], tags: ['smartwatch', 'fitness', 'gadget'],
      specs: [{ label: 'Display', value: '1.85" HD' }, { label: 'Battery', value: '7 days' }, { label: 'Waterproof', value: 'IP68' }, { label: 'Compatibility', value: 'Android/iOS' }],
      weight: 0.12, dims: '4.5 x 3.8 x 1.1 cm', shipNote: 'Ships within 24 hours', sold: 189,
      variants: [
        { name: 'Black', sku: 'NW-WATCH-02-BLK', color: 'Black', stock: 30 },
        { name: 'Silver', sku: 'NW-WATCH-02-SLV', color: 'Silver', stock: 20 },
        { name: 'Pink', sku: 'NW-WATCH-02-PNK', color: 'Pink', stock: 14 },
      ],
    },
    {
      sku: 'NW-EARB-03', slug: 'wireless-earbuds-pro', title: 'Wireless Earbuds Pro — ANC, 36h Playtime',
      titleAr: 'سماعات لاسلكية برو — عزل ضوضاء وبطارية 36 ساعة',
      price: 99, compareAt: 159, cost: 40, stock: 120, cat: 'mobile-accessories', brand: 'NovaTech',
      featured: true, best: false, recommended: true, discount: 38,
      desc: 'Active noise cancellation, crystal-clear calls with dual mics, 36-hour total playtime with charging case, touch controls, Bluetooth 5.3.',
      descAr: 'عزل ضوضاء نشط، مكالمات واضحة بميكروفونين، 36 ساعة تشغيل مع علبة الشحن، تحكم باللمس، بلوتوث 5.3.',
      images: [IMG('earbuds.jpg')], tags: ['earbuds', 'audio', 'new'],
      specs: [{ label: 'ANC', value: 'Yes' }, { label: 'Playtime', value: '36h (with case)' }, { label: 'Bluetooth', value: '5.3' }, { label: 'Charging', value: 'USB-C' }],
      weight: 0.05, dims: '6 x 5 x 2.5 cm', shipNote: 'Ships within 24 hours', sold: 342,
    },
    {
      sku: 'UX-LED-04', slug: 'led-strip-lights', title: 'Smart LED Strip Lights 5m — App & Remote Control',
      titleAr: 'شريط إضاءة LED ذكي 5 متر — تحكم بالتطبيق والريموت',
      price: 59, compareAt: 99, cost: 22, stock: 200, cat: 'home-kitchen', brand: 'UrbanX',
      featured: false, best: true, recommended: true, discount: 40,
      desc: '16 million colors, music sync mode, timer, 5m strip with 5050 LEDs. Easy self-adhesive install — bedroom, living room, gaming setup.',
      descAr: '16 مليون لون، وضع مزامنة الموسيقى، مؤقت، شريط 5 متر بإضاءة 5050 LED. تركيب سهل ذاتي اللصق.',
      images: [IMG('led-strip.jpg')], tags: ['lighting', 'smart-home', 'gaming'],
      specs: [{ label: 'Length', value: '5m' }, { label: 'Colors', value: '16M' }, { label: 'Control', value: 'App + Remote' }, { label: 'Sync', value: 'Music mode' }],
      weight: 0.3, dims: '10 x 10 x 5 cm', shipNote: 'Ships within 24 hours', sold: 501,
    },
    {
      sku: 'PL-SKIN-05', slug: 'vitamin-c-skincare-set', title: 'Vitamin C Skincare Set — Serum + Cream + Cleanser',
      titleAr: 'مجموعة العناية بفيتامين C — سيروم + كريم + غسول',
      price: 89, compareAt: 140, cost: 34, stock: 75, cat: 'beauty', brand: 'PureLife',
      featured: false, best: true, recommended: false, discount: 36,
      desc: 'Brightening 3-piece routine with Vitamin C, Hyaluronic Acid and Niacinamide. Dermatologically tested, suitable for all skin types.',
      descAr: 'روتين مكوّن من 3 قطع لتفتيح البشرة بفيتامين C وحمض الهيالورونيك والنياسيناميد. مختبر من أطباء الجلدية، مناسب لجميع أنواع البشرة.',
      images: [IMG('skincare.jpg')], tags: ['skincare', 'beauty'],
      specs: [{ label: 'Contents', value: '3 pcs' }, { label: 'Skin type', value: 'All' }, { label: 'Cruelty-free', value: 'Yes' }],
      weight: 0.4, dims: '15 x 10 x 8 cm', shipNote: 'Ships within 24 hours', sold: 156,
    },
    {
      sku: 'DP-VAC-06', slug: 'car-vacuum-cleaner', title: 'Handheld Car Vacuum Cleaner — 8000Pa, Wireless',
      titleAr: 'مكنسة سيارة يدوية — 8000 باسكال، لاسلكية',
      price: 119, compareAt: 189, cost: 48, stock: 55, cat: 'car-accessories', brand: 'DrivePro',
      featured: false, best: false, recommended: true, discount: 37,
      desc: 'Powerful 8000Pa suction, HEPA filter, USB-C rechargeable, LED light for dark spots. Cleans seats, carpets, dashboard and crevices.',
      descAr: 'شفط قوي 8000 باسكال، فلتر HEPA، شحن USB-C، إضاءة LED للأماكن المظلمة. تنظيف المقاعد والسجاد والطبلون.',
      images: [IMG('car-vacuum.jpg')], tags: ['car', 'cleaning'],
      specs: [{ label: 'Suction', value: '8000Pa' }, { label: 'Battery', value: '120 min' }, { label: 'Filter', value: 'HEPA' }, { label: 'Charging', value: 'USB-C' }],
      weight: 0.8, dims: '30 x 8 x 8 cm', shipNote: 'Ships within 24 hours', sold: 98,
    },
    {
      sku: 'NW-SPK-07', slug: 'portable-bluetooth-speaker', title: 'Portable Bluetooth Speaker — 360° Sound, IPX7',
      titleAr: 'سماعة بلوتوث محمولة — صوت 360 درجة، IPX7',
      price: 139, compareAt: 219, cost: 60, stock: 88, cat: 'electronics', brand: 'NovaTech',
      featured: true, best: false, recommended: false, discount: 37,
      desc: 'Big 360° sound in a pocket size. 20-hour battery, IPX7 waterproof, TWS pairing, built-in mic for calls. Beach, desert, camping — anywhere.',
      descAr: 'صوت 360 درجة كبير بحجم الجيب. بطارية 20 ساعة، مقاومة للماء IPX7، إقران TWS، ميكروفون للمكالمات. للشاطئ والصحراء والتخييم.',
      images: [IMG('speaker.jpg')], tags: ['audio', 'speaker'],
      specs: [{ label: 'Output', value: '20W 360°' }, { label: 'Battery', value: '20h' }, { label: 'Waterproof', value: 'IPX7' }, { label: 'TWS', value: 'Yes' }],
      weight: 0.5, dims: '10 x 10 x 9 cm', shipNote: 'Ships within 24 hours', sold: 132,
    },
    {
      sku: 'ZS-MSG-08', slug: 'neck-massager', title: 'Neck & Shoulder Massager — Heat + 3 Modes',
      titleAr: 'مساج للرقبة والكتف — تدفئة + 3 أوضاع',
      price: 169, compareAt: 259, cost: 75, stock: 42, cat: 'lifestyle', brand: 'ZenStyle',
      featured: false, best: true, recommended: false, discount: 35,
      desc: 'Deep-kneading shiatsu massage with soothing heat, 3 intensity modes, ergonomic U-shape design. USB rechargeable — relief anywhere.',
      descAr: 'تدليك شياتسو عميق مع تدفئة مريحة، 3 مستويات شدة، تصميم على شكل حرف U. شحن USB — راحة في أي مكان.',
      images: [IMG('massager.jpg')], tags: ['wellness', 'relax'],
      specs: [{ label: 'Modes', value: '3' }, { label: 'Heat', value: '42°C' }, { label: 'Battery', value: '150 min' }, { label: 'Design', value: 'U-shape' }],
      weight: 1.1, dims: '30 x 20 x 12 cm', shipNote: 'Ships within 24 hours', sold: 77,
    },
    {
      sku: 'HG-PHONE-09', slug: 'magsafe-phone-case', title: 'Magnetic Phone Case Set — 4 Colors, Shockproof',
      titleAr: 'طقم أغطية جوال مغناطيسية — 4 ألوان، مقاومة للصدمات',
      price: 49, compareAt: 79, cost: 18, stock: 300, cat: 'mobile-accessories', brand: 'UrbanX',
      featured: false, best: false, recommended: true, discount: 38,
      desc: 'Slim magnetic case with soft-touch finish, raised camera bezel, wireless charging compatible. 4 colors in one pack — switch it up.',
      descAr: 'غطاء مغناطيسي رفيع بلمسة ناعمة، حافة بارزة للكاميرا، متوافق مع الشحن اللاسلكي. 4 ألوان في طقم واحد.',
      images: [IMG('phone-case.jpg')], tags: ['accessories', 'case'],
      specs: [{ label: 'Pack', value: '4 colors' }, { label: 'Material', value: 'TPU + PC' }, { label: 'Magnetic', value: 'Yes' }],
      weight: 0.15, dims: '16 x 8 x 2 cm', shipNote: 'Ships within 24 hours', sold: 421,
    },
    {
      sku: 'HG-ORG-10', slug: 'kitchen-organizer-set', title: 'Kitchen Organizer Set — 3 Pcs Stackable',
      titleAr: 'طقم تنظيم المطبخ — 3 قطع قابلة للتكديس',
      price: 69, compareAt: 109, cost: 26, stock: 96, cat: 'home-kitchen', brand: 'HomeGlow',
      featured: false, best: false, recommended: false, discount: 37,
      desc: 'BPA-free food containers with airtight lids, stackable design saves 40% space. For pantry, fridge, and counters.',
      descAr: 'حاويات طعام خالية من BPA بأغطية محكمة الإغلاق، تصميم قابل للتكديس يوفر 40% من المساحة. للمخزن والثلاجة والطاولات.',
      images: [IMG('organizer.jpg')], tags: ['kitchen', 'storage'],
      specs: [{ label: 'Pieces', value: '3' }, { label: 'Material', value: 'BPA-free PP' }, { label: 'Stackable', value: 'Yes' }],
      weight: 0.9, dims: '25 x 20 x 15 cm', shipNote: 'Ships within 24 hours', sold: 143,
    },
    {
      sku: 'PL-DRY-11', slug: 'ionic-hair-dryer', title: 'Ionic Hair Dryer — Low Noise, Fast Dry',
      titleAr: 'مجفف شعر أيوني — منخفض الضوضاء وسريع التجفيف',
      price: 159, compareAt: 239, cost: 68, stock: 38, cat: 'beauty', brand: 'PureLife',
      featured: false, best: false, recommended: false, discount: 33,
      desc: 'Negative ionic technology reduces frizz, 1600W fast drying, 3 heat + 2 speed settings, cool shot button, lightweight design.',
      descAr: 'تقنية الأيونات السالبة تقلل التجعد، تجفيف سريع 1600 واط، 3 مستويات حرارة وسرعتان، زر هواء بارد، تصميم خفيف.',
      images: [IMG('hair-dryer.jpg')], tags: ['beauty', 'hair'],
      specs: [{ label: 'Power', value: '1600W' }, { label: 'Ionic', value: 'Yes' }, { label: 'Settings', value: '3 heat / 2 speed' }],
      weight: 0.45, dims: '22 x 8 x 20 cm', shipNote: 'Ships within 24 hours', sold: 64,
    },
    {
      sku: 'UX-SUN-12', slug: 'polarized-sunglasses', title: 'Polarized Sunglasses — UV400, Unisex',
      titleAr: 'نظارات شمسية مستقطبة — حماية UV400، للجنسين',
      price: 79, compareAt: 129, cost: 28, stock: 150, cat: 'lifestyle', brand: 'UrbanX',
      featured: true, best: false, recommended: false, discount: 39,
      desc: 'Classic aviator style with polarized UV400 lenses, metal frame, anti-glare. Comes with a premium hard case.',
      descAr: 'تصميم طيار كلاسيكي بعدسات مستقطبة UV400، إطار معدني، مضادة للوهج. تأتي مع علبة صلبة فاخرة.',
      images: [IMG('sunglasses.jpg')], tags: ['fashion', 'summer'],
      specs: [{ label: 'Lens', value: 'Polarized UV400' }, { label: 'Frame', value: 'Metal' }, { label: 'Includes', value: 'Hard case' }],
      weight: 0.1, dims: '15 x 5 x 4 cm', shipNote: 'Ships within 24 hours', sold: 205,
    },
  ];

  const productIds: number[] = [];
  for (const p of productDefs) {
    const created = await prisma.product.upsert({
      where: { sku: p.sku },
      create: {
        sku: p.sku, slug: p.slug, title: p.title, titleAr: p.titleAr,
        description: p.desc, descriptionAr: p.descAr,
        price: p.price, compareAtPrice: p.compareAt, costPrice: p.cost, discountPercent: p.discount,
        stock: p.stock, lowStockThreshold: 5,
        categoryId: catIds[p.cat], brandId: brandIds[p.brand],
        status: 'PUBLISHED',
        isFeatured: p.featured, isBestSeller: p.best, isRecommended: p.recommended,
        isDemo: true,
        weightKg: p.weight, dimensions: p.dims, shippingNote: p.shipNote,
        specifications: p.specs as never, tags: p.tags,
        ratingAvg: 4.5 + Math.random() * 0.4, ratingCount: 20 + Math.floor(Math.random() * 80),
        soldCount: p.sold,
        seoTitle: `${p.title} — Cash on Delivery Dubai UAE`,
        seoDescription: p.desc.slice(0, 155),
        images: { create: p.images.map((url: string, idx: number) => ({ url, sortOrder: idx, isThumbnail: idx === 0, alt: p.title })) },
        variants: p.variants ? { create: p.variants.map((v) => ({ name: v.name, sku: v.sku, color: v.color, stock: v.stock })) } : undefined,
      },
      update: {
        title: p.title, titleAr: p.titleAr, price: p.price, compareAtPrice: p.compareAt,
        stock: p.stock, categoryId: catIds[p.cat], brandId: brandIds[p.brand],
        status: 'PUBLISHED', isFeatured: p.featured, isBestSeller: p.best, isRecommended: p.recommended,
        deletedAt: null, isDemo: true,
      },
    });
    productIds.push(created.id);
  }
  console.log(`  ✓ ${productDefs.length} products`);

  // ---- Flash sale (active now) ----
  const flashSale = await prisma.flashSale.create({
    data: {
      title: 'Mega Flash Sale — Up to 40% OFF',
      titleAr: 'تخفيضات فلاش ضخمة — خصم حتى 40%',
      bannerUrl: '/images/categories/gadgets.jpg',
      startsAt: hoursFromNow(-24), endsAt: hoursFromNow(11), isActive: true, isDemo: true,
      items: {
        create: [
          { productId: productIds[0], salePrice: 99, stockLimit: 50 },
          { productId: productIds[1], salePrice: 119, stockLimit: 40 },
          { productId: productIds[2], salePrice: 79, stockLimit: 60 },
          { productId: productIds[6], salePrice: 109, stockLimit: 30 },
        ],
      },
    },
  });
  void flashSale;
  console.log('  ✓ flash sale');

  // ---- Coupons ----
  await prisma.coupon.createMany({
    data: [
      { code: 'WELCOME10', type: 'PERCENTAGE', value: 10, minOrderAmount: 100, maxDiscount: 30, perCustomerLimit: 1, usageLimit: 1000, isActive: true, isDemo: true },
      { code: 'DXB20', type: 'FIXED', value: 20, minOrderAmount: 150, perCustomerLimit: 2, usageLimit: 500, isActive: true, isDemo: true },
      { code: 'FREESHIP', type: 'FREE_SHIPPING', value: 0, minOrderAmount: 199, perCustomerLimit: 1, usageLimit: 300, isActive: true, isDemo: true },
    ],
  });
  console.log('  ✓ coupons');

  // ---- Demo customers ----
  const demoCustomers = [
    { name: 'Ahmed Hassan', phone: '0501234567', email: 'ahmed@example.com' },
    { name: 'Fatima Al Mansouri', phone: '0559876543', email: 'fatima@example.com' },
    { name: 'Omar Khalid', phone: '0523456789', email: null },
    { name: 'Layla Rahman', phone: '0581112223', email: 'layla@example.com' },
    { name: 'Yousef Nasser', phone: '0564445556', email: null },
  ];
  const customerIds: number[] = [];
  for (const c of demoCustomers) {
    const created = await prisma.customer.create({
      data: { name: c.name, phone: c.phone, email: c.email, isDemo: true, isVerified: true, lastOrderAt: daysAgo(2) },
    });
    customerIds.push(created.id);
  }

  // ---- Demo orders (spread over last 30 days) ----
  const statuses: { status: OrderStatus; daysAgoN: number }[] = [
    { status: 'DELIVERED', daysAgoN: 25 }, { status: 'DELIVERED', daysAgoN: 21 },
    { status: 'DELIVERED', daysAgoN: 18 }, { status: 'COD_COLLECTED', daysAgoN: 14 },
    { status: 'DELIVERED', daysAgoN: 12 }, { status: 'SHIPPED', daysAgoN: 9 },
    { status: 'OUT_FOR_DELIVERY', daysAgoN: 7 }, { status: 'PROCESSING', daysAgoN: 5 },
    { status: 'CONFIRMED', daysAgoN: 3 }, { status: 'NEW', daysAgoN: 1 },
    { status: 'NEW', daysAgoN: 0 }, { status: 'FAILED_DELIVERY', daysAgoN: 6 },
    { status: 'CANCELLED', daysAgoN: 10 }, { status: 'RETURN_REQUESTED', daysAgoN: 4 },
  ];

  for (let i = 0; i < statuses.length; i++) {
    const s = statuses[i];
    const customerIdx = i % demoCustomers.length;
    const customer = demoCustomers[customerIdx];
    const productIdx = (i * 2) % productDefs.length;
    const product = productDefs[productIdx];
    const qty = (i % 3) + 1;
    const subtotal = product.price * qty;
    const shipping = i % 2 === 0 ? 15 : 25;
    const discount = i % 4 === 0 ? Math.round(subtotal * 0.1 * 100) / 100 : 0;
    const total = subtotal - discount + shipping;
    const date = daysAgo(s.daysAgoN, 10 + (i % 10), (i * 7) % 60);

    const order = await prisma.order.create({
      data: {
        orderNumber: `DXB-DEMO-${String(1000 + i)}`,
        customerId: customerIds[customerIdx],
        customerName: customer.name,
        customerPhone: customer.phone,
        customerEmail: customer.email,
        emirate: ['DUBAI', 'DUBAI', 'ABU_DHABI', 'SHARJAH', 'DUBAI', 'AJMAN'][i % 6],
        area: ['Al Barsha', 'Deira', 'Khalifa City', 'Al Nahda', 'Marina', 'Al Nuaimia'][i % 6],
        address: `Street ${10 + i}, Building ${20 + i}`,
        building: `Bldg ${20 + i}`,
        apartment: `Apartment ${(i + 1) * 4}`,
        subtotal, discount, shippingFee: shipping, codFee: 0, total,
        status: s.status,
        isDemo: true,
        deliveryEstimate: '1-3 business days',
        placedAt: date,
        ...(s.status === 'DELIVERED' || s.status === 'COD_COLLECTED' ? { deliveredAt: new Date(date.getTime() + 2 * 86400000) } : {}),
        ...(['CANCELLED', 'RETURNED'].includes(s.status) ? { cancelledAt: date } : {}),
        items: {
          create: [{
            productId: productIds[productIdx],
            productTitle: product.title,
            productTitleAr: product.titleAr,
            sku: product.sku,
            quantity: qty,
            unitPrice: product.price,
            totalPrice: product.price * qty,
            imageUrl: IMG(product.images[0].split('/').pop()!),
          }],
        },
        statusHistory: {
          create: [
            { status: 'NEW', changedByName: 'Customer', createdAt: date },
            ...(s.status !== 'NEW'
              ? [{ status: 'CONFIRMED', changedByName: 'Demo Admin', createdAt: new Date(date.getTime() + 3600000) }]
              : []),
            ...(s.status !== 'NEW' && s.status !== 'CONFIRMED'
              ? [{ status: 'PROCESSING', changedByName: 'Demo Admin', createdAt: new Date(date.getTime() + 2 * 3600000) }]
              : []),
            ...(s.status !== 'NEW' && s.status !== 'CONFIRMED' && s.status !== 'PROCESSING'
              ? [{ status: 'SHIPPED', changedByName: 'Demo Admin', createdAt: new Date(date.getTime() + 26 * 3600000) }]
              : []),
            ...(s.status === 'DELIVERED' || s.status === 'COD_COLLECTED'
              ? [{ status: 'DELIVERED', changedByName: 'Demo Courier', createdAt: new Date(date.getTime() + 50 * 3600000) }]
              : []),
            ...(s.status === 'COD_COLLECTED'
              ? [{ status: 'COD_COLLECTED', changedByName: 'Demo Admin', createdAt: new Date(date.getTime() + 52 * 3600000) }]
              : []),
          ].map((h) => ({ ...h, status: h.status as OrderStatus })),
        },
      },
    });
    void order;
  }
  console.log(`  ✓ ${statuses.length} demo orders`);

  // ---- Demo reviews ----
  const reviewDefs = [
    { productIdx: 0, name: 'Sara M.', rating: 5, title: 'Amazing blender!', content: 'Super fast delivery to Dubai Marina and the blender works perfectly. Paid cash on delivery — very easy.', featured: true },
    { productIdx: 1, name: 'Khalid A.', rating: 5, title: 'Great watch for the price', content: 'Battery lasts a full week as promised. Calls sound clear. Highly recommend.', featured: true },
    { productIdx: 2, name: 'Mariam K.', rating: 4, title: 'Good sound, great value', content: 'ANC works well on the metro. Case is compact. Only wish battery was longer.', featured: false },
    { productIdx: 3, name: 'Rashid O.', rating: 5, title: 'Room looks amazing', content: 'Installed behind my TV in 10 minutes. The app control is very smooth.', featured: false },
    { productIdx: 4, name: 'Noura S.', rating: 4, title: 'Skin feels fresh', content: 'Lovely set, no irritation. Delivery to Abu Dhabi took 2 days.', featured: true },
    { productIdx: 5, name: 'Faisal T.', rating: 5, title: 'Powerful little vacuum', content: 'Cleans my car seats perfectly. The LED light really helps at night.', featured: false },
    { productIdx: 7, name: 'Hessa R.', rating: 5, title: 'Neck pain relief', content: 'The heat function is my favourite. Use it every evening after work.', featured: true },
    { productIdx: 11, name: 'Mohammed D.', rating: 4, title: 'Stylish sunglasses', content: 'Great quality for the price, comes with a nice case.', featured: false },
  ];
  for (const r of reviewDefs) {
    const product = productDefs[r.productIdx];
    await prisma.review.create({
      data: {
        productId: productIds[r.productIdx],
        customerId: customerIds[r.productIdx % customerIds.length],
        displayName: r.name,
        rating: r.rating,
        title: r.title,
        content: r.content,
        isApproved: true,
        isFeatured: r.featured,
        isVerifiedPurchase: true,
        isDemo: true,
        createdAt: daysAgo(3 + r.productIdx),
      },
    });
    void product;
  }
  console.log('  ✓ reviews');

  // ---- Homepage sections ----
  const sections = [
    { type: 'HERO', sortOrder: 1, isEnabled: true, title: 'Premium Products. Delivered Fast.', titleAr: 'منتجات فاخرة. توصيل سريع.', subtitle: 'Shop the best gadgets, home & lifestyle products with Cash on Delivery across all 7 emirates.', subtitleAr: 'تسوق أفضل الأجهزة والمنتجات المنزلية مع الدفع عند الاستلام في جميع الإمارات السبع.', config: { image: '/images/hero.jpg', discountBadge: '-40%', countdownEnabled: true, ctaText: 'Shop Now', ctaTextAr: 'تسوق الآن', ctaLink: '/shop' } },
    { type: 'CATEGORIES', sortOrder: 2, isEnabled: true, title: 'Shop by Category', titleAr: 'تسوق حسب الفئة' },
    { type: 'FLASH_SALE', sortOrder: 3, isEnabled: true, title: 'Flash Sale', titleAr: 'تخفيضات فلاش', subtitle: 'Hurry — deals end soon', subtitleAr: 'أسرع — تنتهي العروض قريباً' },
    { type: 'FEATURED', sortOrder: 4, isEnabled: true, title: 'Featured Products', titleAr: 'منتجات مميزة' },
    { type: 'BEST_SELLERS', sortOrder: 5, isEnabled: true, title: 'Best Sellers', titleAr: 'الأكثر مبيعاً' },
    { type: 'TRUST_BADGES', sortOrder: 6, isEnabled: true, title: 'Why Shop With Us', titleAr: 'لماذا تتسوق معنا' },
    { type: 'COD_BANNER', sortOrder: 7, isEnabled: true, title: 'Cash on Delivery', titleAr: 'الدفع عند الاستلام', subtitle: 'Pay only when your order arrives at your door. No prepayment, no risk.', subtitleAr: 'ادفع فقط عند وصول طلبك إلى بابك. لا دفع مسبق، لا مخاطرة.', config: { image: '/images/cod-banner.jpg' } },
    { type: 'SOCIAL_PROOF', sortOrder: 8, isEnabled: true, title: 'Recently Sold', titleAr: 'تم البيع مؤخراً' },
    { type: 'RECOMMENDED', sortOrder: 9, isEnabled: true, title: 'Recommended For You', titleAr: 'موصى به لك' },
    { type: 'REVIEWS', sortOrder: 10, isEnabled: true, title: 'What Our Customers Say', titleAr: 'ماذا يقول عملاؤنا' },
    { type: 'FAQ', sortOrder: 11, isEnabled: true, title: 'Frequently Asked Questions', titleAr: 'الأسئلة الشائعة', config: { faqs: [
      { q: 'Is Cash on Delivery available in my emirate?', a: 'Yes — we deliver with COD to all 7 emirates: Dubai, Abu Dhabi, Sharjah, Ajman, Umm Al Quwain, Ras Al Khaimah and Fujairah.', qAr: 'هل الدفع عند الاستلام متاح في إمارتي؟', aAr: 'نعم — نوصل مع الدفع عند الاستلام إلى جميع الإمارات السبع: دبي وأبوظبي والشارقة وعجمان وأم القيوين ورأس الخيمة والفجيرة.' },
      { q: 'How long does delivery take?', a: 'Dubai orders typically arrive in 1-2 business days. Other emirates take 2-3 business days.', qAr: 'كم يستغرق التوصيل؟', aAr: 'طلبات دبي تصل عادة خلال 1-2 يوم عمل. باقي الإمارات تستغرق 2-3 أيام عمل.' },
      { q: 'Can I return a product?', a: 'Yes — you have 7 days to request a return or exchange. See our Return Policy for details.', qAr: 'هل يمكنني إرجاع المنتج؟', aAr: 'نعم — لديك 7 أيام لطلب الإرجاع أو الاستبدال. راجع سياسة الإرجاع للتفاصيل.' },
      { q: 'How do I track my order?', a: 'Use the Track Order page with your order ID and mobile number. You will also receive SMS updates.', qAr: 'كيف أتابع طلبي؟', aAr: 'استخدم صفحة تتبع الطلب مع رقم الطلب ورقم جوالك. ستتلقى أيضاً تحديثات عبر الرسائل النصية.' },
    ] } },
    { type: 'NEWSLETTER', sortOrder: 12, isEnabled: true, title: 'Get 10% Off Your First Order', titleAr: 'احصل على خصم 10% على طلبك الأول', subtitle: 'Subscribe and receive exclusive offers straight to your inbox.', subtitleAr: 'اشترك واستلم عروضاً حصرية على بريدك.' },
  ];
  for (const s of sections) {
    await prisma.homepageSection.create({
      data: { type: s.type, title: s.title, titleAr: s.titleAr, subtitle: s.subtitle, subtitleAr: s.subtitleAr, config: (s.config || {}) as never, sortOrder: s.sortOrder, isEnabled: s.isEnabled },
    });
  }
  console.log('  ✓ homepage sections');

  // ---- Demo analytics events for charts ----
  for (let i = 0; i < 60; i++) {
    await prisma.analyticsEvent.create({
      data: {
        type: 'PAGE_VIEW',
        createdAt: daysAgo(29 - Math.floor(i / 2), 9 + (i % 12), (i * 13) % 60),
        meta: { page: ['/', '/shop', '/product/smart-watch-fitness'][i % 3] } as never,
        isDemo: true,
      },
    });
  }
  for (let i = 0; i < 25; i++) {
    await prisma.analyticsEvent.create({
      data: {
        type: 'PRODUCT_VIEW',
        productId: productIds[i % productIds.length],
        createdAt: daysAgo(29 - Math.floor(i / 2), 10 + (i % 11), (i * 17) % 60),
        isDemo: true,
      },
    });
  }
  for (let i = 0; i < 12; i++) {
    await prisma.analyticsEvent.create({
      data: { type: 'ADD_TO_CART', createdAt: daysAgo(20 - i, 12 + (i % 9)), isDemo: true },
    });
  }
  for (let i = 0; i < 8; i++) {
    await prisma.analyticsEvent.create({
      data: { type: 'CHECKOUT_STARTED', createdAt: daysAgo(15 - i, 14 + (i % 8)), isDemo: true },
    });
  }

  console.log('✅ Seed complete.');
  console.log('');
  console.log('Demo admin login (DEMO ONLY — change before production):');
  console.log('  admin@desertcart.ae  /  Admin@12345   (SUPER_ADMIN)');
  console.log('  manager@desertcart.ae / Manager@12345 (MANAGER)');
  console.log('  orders@desertcart.ae  /  Orders@12345  (ORDER_MANAGER)');
  console.log('  viewer@desertcart.ae  /  Viewer@12345  (VIEWER)');
  console.log('Storefront demo customer: 0501234567 (guest checkout — no password needed)');
}

function isPublicKey(key: string): boolean {
  return [
    'store.name', 'store.nameAr', 'store.tagline', 'store.logo', 'store.favicon', 'store.email', 'store.phone', 'store.whatsapp',
    'store.currency', 'store.country', 'store.defaultLanguage', 'store.workingHours', 'store.address',
    'shipping.zones', 'shipping.freeShippingThreshold', 'shipping.minOrderAmount', 'shipping.deliveryEstimateDays', 'shipping.codAvailable',
    'orders.prefix', 'announcement.', 'popups.', 'theme.', 'seo.', 'social.', 'footer.', 'checkout.',
    'analytics.gaId', 'analytics.metaPixelId', 'maintenance.enabled', 'maintenance.message',
  ].some((p) => (p.endsWith('.') ? key.startsWith(p) : key === p));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
