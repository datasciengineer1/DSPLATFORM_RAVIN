export const runtime = 'nodejs';

function hash(s: string){ let h=0; for(let i=0;i<s.length;i++) h=(Math.imul(31,h)+s.charCodeAt(i))|0; return Math.abs(h); }
function seeded(seed:number){ let t=(seed%2147483647)||1; return ()=> (t=(t*48271)%2147483647)/2147483647; }

export async function GET(_req: Request, { params }: { params: { id: string[] } }) {
  const raw = Array.isArray(params.id) ? params.id.join("/") : String(params.id || "");
  const id = decodeURIComponent(raw || "demo");
  const rnd = seeded(hash(id));

  const rowCount = 3000 + Math.floor(rnd()*7000);
  const colCount = 12 + Math.floor(rnd()*10);
  const numericCount = Math.max(5, Math.floor(colCount/2));
  const categoricalCount = colCount - numericCount;

  const distCOGS = ["0-100","100-300","300-600","600-1k","1k-2k"].map((b)=>({ name:b, value: Math.round(40 + rnd()*140) }));
  const distRevenue = ["0-500","500-2k","2k-5k","5k-10k","10k+"].map((b)=>({ name:b, value: Math.round(20 + rnd()*120) }));
  const cats = ["Devices","Theater","Computers","Cables","Cameras","Accessories"];
  const countsByCategory = cats.map(c=>({ name:c, value: Math.round(30 + rnd()*130) }));
  const cities = ["SF","NYC","LA","SEA","DAL","CHI"];
  const shareByCity = cities.map(c=>({ name:c, value: Math.round(10 + rnd()*40) }));
  const cogsVsRevenue = Array.from({length:40}, (_,i)=>({ x: 40 + i*(2 + rnd()*5), y: 30 + i*(1.5 + rnd()*3) + (rnd()-0.5)*25 }));
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const trendCogsByMonth = months.slice(0,6+Math.floor(rnd()*6)).map((m,i)=>({ name:m, value: Math.round(40 + i*(rnd()*8+2) + (rnd()-0.5)*6) }));

  const subcats = ["Tablets","TV","Laptops","USB-C","Mirrorless","Smartwatches","Speakers","Monitors","Cables","Mice"];
  const preview = Array.from({length: 100}, (_,i)=>({
    Month: `${months[i%12]}-01-2024`,
    Category_ID: 1 + (i % 6),
    Category: cats[i % cats.length],
    Subcategory_ID: 1 + (i % subcats.length),
    Subcategory: subcats[i % subcats.length],
    Product_ID: 1000 + i,
    Product: `SKU-${1000+i}`,
  }));

  return new Response(JSON.stringify({
    datasetId: id, rowCount, colCount, numericCount, categoricalCount,
    insights: [
      "Revenue appears right-skewed (long tail).",
      "COGS and Revenue show a positive relationship.",
      "Mild seasonality is present across months."
    ],
    recommendations: [
      "How does Revenue vary by Month?",
      "Is Revenue correlated with Category_ID?",
      "Which combo of Month, Category, Category_ID maximizes Revenue?"
    ],
    preview, distCOGS, distRevenue, countsByCategory, shareByCity, cogsVsRevenue, trendCogsByMonth,
  }), { status:200, headers:{ "content-type":"application/json" }});
}
