// Página do upsell "Acelerador Shoppfy 30 Dias" (R$ 247), aberta pela Applyfy
// logo depois da compra da Shoppfy (funil → upsell com página externa).
// Os botões de comprar / recusar são o iframe da Applyfy dentro do bloco
// #oferta; o script product-funnel.js liga o iframe à compra (one-click).
// O HTML é estático (dangerouslySetInnerHTML) de propósito: o script da
// Applyfy substitui o <iframe> no DOM, e o React não pode re-renderizar ele.
import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";

const FUNNEL_SCRIPT = "https://app.applyfy.com.br/scripts/product-funnel.js";

export const Route = createFileRoute("/acelerador")({
  head: () => ({
    meta: [
      { title: "Acelerador Shoppfy — com Jp Nogueiraz" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AceleradorPage,
});

const CSS = `
.acel{
  --bg:#000;--s1:#0A0A0A;--s2:#141414;--line:#1F1F1F;--line2:#2A2A2A;
  --t1:#F5F5F7;--t2:#A1A1A6;--t3:#6E6E73;
}
:where(.acel, .acel *){box-sizing:border-box;margin:0;padding:0}
.acel{min-height:100vh;background:var(--bg);color:var(--t1);font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","SF Pro Text","Helvetica Neue",Inter,system-ui,sans-serif;
  -webkit-font-smoothing:antialiased;letter-spacing:-.011em;line-height:1.47}
:where(.acel) a{color:inherit;text-decoration:none}

.layout{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:72px;max-width:1180px;margin:0 auto;padding:0 32px}
main{min-width:0}

/* topo */
.nav{display:flex;align-items:center;justify-content:space-between;height:64px;border-bottom:1px solid var(--line)}
.logo{display:flex;align-items:center;gap:9px;font-weight:600;font-size:16px;letter-spacing:-.02em}
.logo img{width:24px;height:24px;border-radius:6px;filter:grayscale(1) contrast(1.1)}
.status{font-size:12px;color:var(--t2);display:flex;align-items:center;gap:8px}
.status i{width:6px;height:6px;border-radius:50%;background:var(--t1)}

/* hero */
.hero{padding:96px 0 0}
.eyebrow{font-size:13px;font-weight:600;color:var(--t2);letter-spacing:0}
h1{font-size:clamp(44px,7vw,84px);line-height:1.02;letter-spacing:-.045em;font-weight:700;margin:16px 0 24px}
h1 .soft{color:var(--t3)}
.lede{font-size:clamp(19px,2vw,23px);line-height:1.38;color:var(--t2);max-width:640px;letter-spacing:-.018em}
.lede b{color:var(--t1);font-weight:500}

/* foto */
.portrait{margin-top:72px;position:relative;border-radius:28px;overflow:hidden;background:var(--s1);border:1px solid var(--line);aspect-ratio:16/10}
.portrait .ph{position:absolute;inset:0;background:
   radial-gradient(60% 80% at 70% 30%,#2a2a2a,transparent 70%),
   linear-gradient(180deg,#111,#050505);display:flex;align-items:center;justify-content:center}
.portrait .ph svg{width:42%;height:auto;opacity:.18}
.portrait img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.portrait .cap{position:absolute;left:0;right:0;bottom:0;padding:40px 36px 32px;background:linear-gradient(transparent,rgba(0,0,0,.85))}
.portrait .cap .n{font-size:30px;font-weight:600;letter-spacing:-.03em}
.portrait .cap .r{font-size:15px;color:var(--t2);margin-top:2px}
.portrait .hint{position:absolute;top:20px;right:20px;font-size:11px;color:var(--t3);border:1px solid var(--line2);padding:5px 10px;border-radius:99px;background:rgba(0,0,0,.4)}

/* números */
.nums{display:grid;grid-template-columns:repeat(3,1fr);margin-top:56px;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
.num{padding:32px 0 30px}
.num+.num{padding-left:32px;border-left:1px solid var(--line)}
.num .v{font-size:clamp(34px,4.4vw,52px);font-weight:600;letter-spacing:-.045em;line-height:1}
.num .l{font-size:14px;color:var(--t2);margin-top:8px}

/* blocos */
section{padding:120px 0 0}
.h2{font-size:clamp(32px,4.6vw,52px);line-height:1.06;letter-spacing:-.04em;font-weight:700;max-width:760px}
.h2 .soft{color:var(--t3)}
.sub{font-size:19px;color:var(--t2);margin-top:16px;max-width:600px;letter-spacing:-.016em}

/* hook */
.q{margin-top:44px;display:grid;gap:10px}
.q button{all:unset;cursor:pointer;display:flex;align-items:center;justify-content:space-between;padding:22px 24px;border-radius:18px;background:var(--s1);border:1px solid var(--line);
  font-size:18px;font-weight:500;letter-spacing:-.02em;transition:background .25s,border-color .25s,transform .25s}
.q button:hover{background:var(--s2);border-color:var(--line2)}
.q button .k{width:26px;height:26px;border-radius:50%;border:1px solid var(--line2);display:grid;place-items:center;transition:.25s;flex:none}
.q button .k:after{content:"";width:8px;height:8px;border-radius:50%;background:var(--bg);transition:.25s}
.q button.on{background:var(--t1);color:#000;border-color:var(--t1)}
.q button.on .k{border-color:#000}
.q button.on .k:after{background:#000}
.reply{overflow:hidden;max-height:0;opacity:0;transition:max-height .6s cubic-bezier(.25,.8,.25,1),opacity .5s,margin .5s}
.reply.show{max-height:300px;opacity:1;margin-top:18px}
.reply .in{padding:28px;border-radius:18px;border:1px solid var(--line2);background:var(--s1)}
.reply .w{font-size:13px;color:var(--t3);font-weight:600}
.reply h4{font-size:24px;font-weight:600;letter-spacing:-.03em;line-height:1.2;margin:6px 0 8px}
.reply p{color:var(--t2);font-size:16px}

/* semanas */
.weeks{margin-top:56px;border-top:1px solid var(--line)}
.wk{display:grid;grid-template-columns:120px 1fr;gap:24px;padding:34px 0;border-bottom:1px solid var(--line)}
.wk .d{font-size:14px;color:var(--t3);font-weight:500;padding-top:6px;transition:color .5s}
.wk h3{font-size:28px;font-weight:600;letter-spacing:-.035em;line-height:1.15;color:var(--t3);transition:color .6s}
.wk p{color:var(--t3);margin-top:8px;font-size:17px;max-width:540px;transition:color .6s}
.wk.lit .d{color:var(--t2)}.wk.lit h3{color:var(--t1)}.wk.lit p{color:var(--t2)}

/* brindes */
.gifts{margin-top:56px;display:grid;grid-template-columns:repeat(2,1fr);gap:14px}
.gift{padding:32px;border-radius:24px;background:var(--s1);border:1px solid var(--line);min-height:220px;display:flex;flex-direction:column;justify-content:space-between;transition:border-color .3s,background .3s}
.gift:hover{border-color:var(--line2);background:#0D0D0D}
.gift.wide{grid-column:span 2;min-height:0}
.gift .t{font-size:13px;color:var(--t3);font-weight:600}
.gift h3{font-size:26px;font-weight:600;letter-spacing:-.035em;line-height:1.15;margin-top:40px}
.gift p{color:var(--t2);margin-top:8px;font-size:16px;max-width:440px}
.gift.wide{display:grid;grid-template-columns:1fr 1fr;gap:32px;align-items:end}
.gift.wide h3{margin-top:28px}
.rank{display:grid;gap:0;border-top:1px solid var(--line)}
.rank div{display:flex;justify-content:space-between;padding:13px 0;border-bottom:1px solid var(--line);font-size:15px;color:var(--t2)}
.rank span{color:var(--t3);font-variant-numeric:tabular-nums}

/* frase */
.say{padding:140px 0 0}
.say blockquote{font-size:clamp(30px,4.2vw,48px);line-height:1.12;letter-spacing:-.04em;font-weight:600;max-width:860px}
.say blockquote .soft{color:var(--t3)}
.say .by{margin-top:24px;color:var(--t2);font-size:15px}

/* oferta */
.offer{margin-top:120px;border-radius:28px;border:1px solid var(--line);background:var(--s1);padding:56px;display:grid;grid-template-columns:1.2fr 1fr;gap:56px;align-items:center}
.inc{list-style:none;display:grid;gap:0;border-top:1px solid var(--line)}
.inc li{display:flex;justify-content:space-between;gap:16px;padding:15px 0;border-bottom:1px solid var(--line);font-size:16px}
.inc li span{color:var(--t3)}
.pricebox .p{font-size:clamp(64px,7vw,92px);font-weight:600;letter-spacing:-.06em;line-height:.95}
.pricebox .p small{font-size:.3em;color:var(--t2);letter-spacing:-.02em;font-weight:500;vertical-align:top;position:relative;top:.55em;margin-right:6px}
.pricebox .o{color:var(--t2);font-size:15px;margin:10px 0 30px}

.btn{display:flex;align-items:center;justify-content:center;width:100%;padding:18px 24px;border-radius:999px;background:var(--t1);color:#000;font-weight:600;font-size:17px;letter-spacing:-.02em;
  transition:transform .2s,background .2s}
.btn:hover{background:#fff;transform:scale(1.015)}
.btn:active{transform:scale(.99)}
.no{display:block;text-align:center;margin-top:16px;font-size:14px;color:var(--t3)}
.no:hover{color:var(--t2)}
.guar{display:flex;gap:14px;margin-top:28px;padding-top:24px;border-top:1px solid var(--line);font-size:14px;color:var(--t2)}
.guar b{color:var(--t1);font-weight:600}

/* faq */
.faq{margin-top:48px;border-top:1px solid var(--line)}
details{border-bottom:1px solid var(--line);padding:24px 0}
summary{cursor:pointer;list-style:none;display:flex;justify-content:space-between;align-items:center;font-size:19px;font-weight:500;letter-spacing:-.02em}
summary::-webkit-details-marker{display:none}
summary:after{content:"";width:10px;height:10px;border-right:1.5px solid var(--t2);border-bottom:1.5px solid var(--t2);transform:rotate(45deg) translateY(-3px);transition:transform .3s}
details[open] summary:after{transform:rotate(-135deg)}
details p{color:var(--t2);margin-top:12px;font-size:16px;max-width:620px}

.end{padding:140px 0 120px;text-align:center}
.end h2{font-size:clamp(36px,5.4vw,64px);letter-spacing:-.045em;line-height:1.02;font-weight:700}
.end h2 .soft{color:var(--t3)}
.end .btn{max-width:380px;margin:40px auto 0}
footer{border-top:1px solid var(--line);padding:24px 0 40px;font-size:12px;color:var(--t3);display:flex;justify-content:space-between}

/* sidebar */
aside{position:relative}
.side{position:sticky;top:96px;margin-top:96px}
.sc{border-radius:24px;border:1px solid var(--line);background:rgba(10,10,10,.85);backdrop-filter:saturate(180%) blur(20px);padding:26px}
.sc .tt{font-size:13px;color:var(--t3);font-weight:600}
.sc .nm{font-size:21px;font-weight:600;letter-spacing:-.03em;margin-top:4px}
.sc .who{display:flex;align-items:center;gap:10px;margin-top:14px;padding-bottom:20px;border-bottom:1px solid var(--line);font-size:14px;color:var(--t2)}
.sc .av{width:32px;height:32px;border-radius:50%;background:#222;display:grid;place-items:center;font-size:12px;font-weight:600;color:var(--t1);overflow:hidden}
.sc .av img{width:100%;height:100%;object-fit:cover}
.chk{list-style:none;display:grid;gap:11px;padding:20px 0}
.chk li{display:flex;gap:10px;align-items:center;font-size:14px;color:var(--t3);transition:color .5s}
.chk li i{width:16px;height:16px;border-radius:50%;border:1px solid var(--line2);flex:none;position:relative;transition:.4s}
.chk li.on{color:var(--t1)}
.chk li.on i{background:var(--t1);border-color:var(--t1)}
.chk li.on i:after{content:"";position:absolute;left:5px;top:2.5px;width:4px;height:7px;border:solid #000;border-width:0 1.5px 1.5px 0;transform:rotate(45deg)}
.sc .pr{display:flex;align-items:baseline;gap:8px;border-top:1px solid var(--line);padding-top:20px}
.sc .pr b{font-size:40px;font-weight:600;letter-spacing:-.05em}
.sc .pr span{font-size:13px;color:var(--t2)}
.sc .btn{margin-top:18px;padding:15px}

.mbar{display:none}

/* animação de entrada */
.rv{opacity:0;transform:translateY(24px);transition:opacity 1.1s cubic-bezier(.25,.8,.25,1),transform 1.1s cubic-bezier(.25,.8,.25,1)}
.rv.in{opacity:1;transform:none}
.hero .rv{transition-duration:1.3s}

@media (max-width:1020px){
  .layout{grid-template-columns:1fr;padding:0 22px}
  aside{display:none}
  .mbar{display:flex;align-items:center;gap:14px;position:fixed;left:12px;right:12px;bottom:12px;z-index:9;padding:10px 10px 10px 20px;border-radius:999px;
    background:rgba(20,20,20,.86);backdrop-filter:saturate(180%) blur(20px);border:1px solid var(--line2)}
  .mbar b{font-size:18px;font-weight:600;letter-spacing:-.03em}
  .mbar .btn{flex:1;padding:13px 18px;font-size:15px}
  .acel{padding-bottom:84px}
  .offer{grid-template-columns:1fr;padding:32px;gap:36px}
  .gifts{grid-template-columns:1fr}.gift.wide{grid-column:auto;grid-template-columns:1fr}
  .wk{grid-template-columns:1fr;gap:6px}
  .num+.num{padding-left:18px}
  .hero{padding-top:64px}
}

.ocb{margin-top:6px;min-height:190px;border-radius:18px;overflow:hidden}
.ocb iframe{display:block;width:100%;height:190px;border:0;background:transparent}
.ocb-hint{font-size:12.5px;color:var(--t3);margin-top:10px;text-align:center}
`;

const HTML = `<div class="layout">
<main>
  <nav class="nav">
    <div class="logo"><img src="/icon-192.png" alt="">Shoppfy</div>
    <div class="status"><i></i>Compra confirmada</div>
  </nav>

  <header class="hero">
    <p class="eyebrow rv">Acelerador Shoppfy · 30 dias</p>
    <h1 class="rv">Quatro semanas.<br><span class="soft">Ao vivo com quem</span><br>já fez R$500 mil.</h1>
    <p class="lede rv">Uma call por semana com o <b>Jp Nogueiraz</b>. Sua loja aberta na tela, os ajustes feitos na hora e acesso ao que só quem está dentro recebe.</p>

    <figure class="portrait rv">
      <div class="ph"><svg viewBox="0 0 100 100" fill="#fff"><circle cx="50" cy="36" r="18"/><path d="M14 96c0-22 16-36 36-36s36 14 36 36z"/></svg></div>
      <img src="/acelerador/jp.jpg" alt="Jp Nogueiraz">
      
      <figcaption class="cap"><div class="n">Jp Nogueiraz</div><div class="r">Criador da Shoppfy · o maior lojista da ferramenta</div></figcaption>
    </figure>

    <div class="nums rv">
      <div class="num"><div class="v" data-count="500" data-pre="R$" data-suf=" mil">R$0 mil</div><div class="l">em vendas na Shopee e no Mercado Livre</div></div>
      <div class="num"><div class="v" data-count="4">0</div><div class="l">calls ao vivo, uma por semana</div></div>
      <div class="num"><div class="v" data-count="30" data-suf=" dias">0 dias</div><div class="l">com acesso direto</div></div>
    </div>
  </header>

  <section>
    <h2 class="h2 rv">Onde você está hoje?</h2>
    <p class="sub rv">Escolha uma opção.</p>
    <div class="q rv" id="q">
      <button data-k="0">Ainda não comecei a vender<span class="k"></span></button>
      <button data-k="1">Tenho visitas, mas pouca venda<span class="k"></span></button>
      <button data-k="2">Vendo, mas não sei se tenho lucro<span class="k"></span></button>
      <button data-k="3">Já vendo e quero escalar<span class="k"></span></button>
    </div>
    <div class="reply" id="reply"><div class="in"><div class="w" id="rw"></div><h4 id="rh"></h4><p id="rp"></p></div></div>
  </section>

  <section>
    <h2 class="h2 rv">O plano. <span class="soft">Uma semana de cada vez.</span></h2>
    <div class="weeks">
      <div class="wk rv"><div class="d">Semana 1</div><div><h3>Loja no ar, do jeito certo.</h3><p>Configuração completa e a escolha dos primeiros produtos com o critério que o Jp usa.</p></div></div>
      <div class="wk rv"><div class="d">Semana 2</div><div><h3>Anúncios que convertem.</h3><p>Título, foto e descrição revisados ao vivo. O que transforma visita em venda.</p></div></div>
      <div class="wk rv"><div class="d">Semana 3</div><div><h3>Preço e lucro de verdade.</h3><p>Taxas, frete e margem. Você sai sabendo exatamente quanto sobra em cada venda.</p></div></div>
      <div class="wk rv"><div class="d">Semana 4</div><div><h3>Escala.</h3><p>Mais produtos, reputação e catálogo. O próximo passo de quem já começou a vender.</p></div></div>
    </div>
  </section>

  <section>
    <h2 class="h2 rv">Só para quem entrar.</h2>
    <p class="sub rv">Nenhum destes itens está disponível no plano da Shoppfy.</p>
    <div class="gifts">
      <div class="gift wide rv">
        <div><div class="t">Toda segunda-feira</div><h3>Produtos Campeões da Semana.</h3><p>Uma lista nova a cada semana com o que mais vendeu nas lojas Shoppfy.</p></div>
        <div class="rank"><div>Produto 01<span>#1</span></div><div>Produto 02<span>#2</span></div><div>Produto 03<span>#3</span></div></div>
      </div>
      <div class="gift rv"><div class="t">Na entrada</div><div><h3>Diagnóstico da sua loja.</h3><p>As 3 correções que mais vão fazer diferença, por escrito.</p></div></div>
      <div class="gift rv"><div class="t">Até 27 de novembro</div><div><h3>Calendário Black Friday e Natal.</h3><p>O que subir, quando e por quanto.</p></div></div>
      <div class="gift rv"><div class="t">30 dias</div><div><h3>Suporte prioritário.</h3><p>Suas dúvidas passam na frente.</p></div></div>
      <div class="gift rv"><div class="t">Sem prazo</div><div><h3>Gravações.</h3><p>Todas as calls disponíveis para rever.</p></div></div>
    </div>
  </section>

  <div class="say">
    <blockquote class="rv">“Não é aula gravada. <span class="soft">Eu abro a minha loja e a sua, e a gente ajusta junto.”</span></blockquote>
    <p class="by rv">Jp Nogueiraz</p>
  </div>

  <div class="offer rv" id="oferta">
    <ul class="inc">
      <li>4 calls ao vivo com o Jp<span>semanal</span></li>
      <li>Revisão da sua loja na tela<span>ao vivo</span></li>
      <li>Grupo exclusivo<span>30 dias</span></li>
      <li>Produtos Campeões da Semana<span>4 listas</span></li>
      <li>Diagnóstico da loja<span>por escrito</span></li>
      <li>Calendário Black Friday e Natal<span>incluso</span></li>
      <li>Suporte prioritário<span>30 dias</span></li>
      <li>Gravações<span>sem prazo</span></li>
    </ul>
    <div class="pricebox">
      <div class="p"><small>R$</small>247</div>
      <div class="o">Pagamento único. Sem mensalidade.</div>
      <div class="ocb"><iframe id="product-funnel-cmvuq8o750p1x01odwhwdlxny" src="https://checkout.applyfy.com.br/ext/funnel/cmvuq8o750p1x01odwhwdlxny" width="100%" height="100%" frameborder="0" allowtransparency="true" allow="payment *"></iframe></div>
      <div class="guar"><div><b>Garantia de 7 dias.</b> Participe da primeira call. Se não for pra você, devolvemos 100%.</div></div>
    </div>
  </div>

  <section>
    <h2 class="h2 rv">Perguntas.</h2>
    <div class="faq rv">
      <details><summary>Quando são as calls?</summary><p>Toda quarta às 20h, ao vivo. O link de cada call fica no grupo da sua turma.</p></details>
      <details><summary>E se eu não puder assistir ao vivo?</summary><p>Todas as calls ficam gravadas.</p></details>
      <details><summary>Preciso já ter vendas?</summary><p>Não. O Acelerador serve para quem está começando e para quem já vende e quer escalar.</p></details>
      <details><summary>Tem mensalidade?</summary><p>Não. É um pagamento único.</p></details>
      
    </div>
  </section>

  <div class="end">
    <h2 class="rv">Você já tem a ferramenta.<br><span class="soft">Agora, o acompanhamento.</span></h2>
    <a class="btn rv" href="#oferta">Entrar no Acelerador — R$247</a>
  </div>
  <footer><span>Shoppfy</span><span>shoppfy.online</span></footer>
</main>

<aside>
  <div class="side">
    <div class="sc">
      <div class="tt">Seu acesso</div>
      <div class="nm">Acelerador Shoppfy</div>
      <div class="who"><div class="av"><img src="/acelerador/jp-avatar.jpg" alt=""></div>Com Jp Nogueiraz</div>
      <ul class="chk" id="chk">
        <li><i></i>4 calls ao vivo</li>
        <li><i></i>Revisão da sua loja</li>
        <li><i></i>Grupo exclusivo</li>
        <li><i></i>Campeões da Semana</li>
        <li><i></i>Diagnóstico da loja</li>
        <li><i></i>Calendário Black Friday</li>
        <li><i></i>Suporte prioritário</li>
        <li><i></i>Gravações</li>
      </ul>
      <div class="pr"><b>R$247</b><span>pagamento único</span></div>
      <a class="btn" href="#oferta">Entrar no Acelerador</a>
    </div>
  </div>
</aside>
</div>

<div class="mbar"><b>R$247</b><a class="btn" href="#oferta">Entrar no Acelerador</a></div>`;

const ANSWERS: Array<[string, string, string]> = [
  [
    "Semana 1",
    "Você sai da primeira call com a loja pronta para vender.",
    "Configuração e escolha de produto, passo a passo, com o critério que o Jp usa nas lojas dele.",
  ],
  [
    "Semana 2",
    "Visita sem venda quase sempre é anúncio.",
    "Na segunda call, o seu anúncio é aberto na tela e ajustado ao vivo.",
  ],
  [
    "Semana 3",
    "Você vai saber quanto sobra em cada venda.",
    "Taxas, frete e preço certo para ter margem real na Shopee e no Mercado Livre.",
  ],
  [
    "Semana 4",
    "Hora de multiplicar o que já funciona.",
    "Mais produtos, reputação e catálogo — o caminho que levou o Jp a R$500 mil.",
  ],
];

function AceleradorPage() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".acel");
    if (!root) return;
    const cleanups: Array<() => void> = [];

    // Animação de entrada no scroll.
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        }),
      { threshold: 0.12 },
    );
    root.querySelectorAll<HTMLElement>(".rv").forEach((el, i) => {
      if (el.closest(".hero")) el.style.transitionDelay = `${i * 120}ms`;
      io.observe(el);
    });
    cleanups.push(() => io.disconnect());

    // Contadores (R$500 mil, 4 calls, 30 dias).
    const co = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          const el = e.target as HTMLElement;
          const to = Number(el.dataset.count);
          const pre = el.dataset.pre ?? "";
          const suf = el.dataset.suf ?? "";
          const t0 = performance.now();
          const step = (t: number) => {
            const p = Math.min(1, (t - t0) / 1800);
            el.textContent = pre + Math.round(to * (1 - Math.pow(1 - p, 4))) + suf;
            if (p < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
          co.unobserve(el);
        }),
      { threshold: 0.6 },
    );
    root.querySelectorAll("[data-count]").forEach((el) => co.observe(el));
    cleanups.push(() => co.disconnect());

    // Pergunta "Onde você está hoje?".
    const reply = root.querySelector("#reply");
    const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>("#q button"));
    buttons.forEach((b) => {
      b.onclick = () => {
        buttons.forEach((x) => x.classList.remove("on"));
        b.classList.add("on");
        const [w, h, p] = ANSWERS[Number(b.dataset.k)];
        root.querySelector("#rw")!.textContent = w;
        root.querySelector("#rh")!.textContent = h;
        root.querySelector("#rp")!.textContent = p;
        reply?.classList.add("show");
      };
    });

    // Semanas acendendo + checklist da lateral enchendo com o scroll.
    const weeks = Array.from(root.querySelectorAll(".wk"));
    const items = Array.from(root.querySelectorAll("#chk li"));
    const onScroll = () => {
      const mid = window.innerHeight * 0.62;
      weeks.forEach((w) => w.classList.toggle("lit", w.getBoundingClientRect().top < mid));
      const d = document.documentElement;
      const s = window.scrollY / (d.scrollHeight - window.innerHeight || 1);
      const n = Math.max(1, Math.ceil(s * items.length * 1.2));
      items.forEach((li, i) => li.classList.toggle("on", i < n));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    cleanups.push(() => window.removeEventListener("scroll", onScroll));

    // No celular, a barra fixa some quando os botões da Applyfy estão na tela.
    const offer = root.querySelector("#oferta");
    const mbar = root.querySelector<HTMLElement>(".mbar");
    if (offer && mbar) {
      const mo = new IntersectionObserver(
        ([e]) => {
          mbar.style.transform = e.isIntersecting ? "translateY(140%)" : "";
        },
        { threshold: 0.15 },
      );
      mo.observe(offer);
      mbar.style.transition = "transform .35s ease";
      cleanups.push(() => mo.disconnect());
    }

    // CTAs internos rolam suave até os botões da Applyfy.
    const prevBehavior = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = "smooth";
    cleanups.push(() => {
      document.documentElement.style.scrollBehavior = prevBehavior;
    });

    // Script do funil da Applyfy (uma vez só).
    if (!document.querySelector(`script[src="${FUNNEL_SCRIPT}"]`)) {
      const sc = document.createElement("script");
      sc.src = FUNNEL_SCRIPT;
      sc.async = true;
      document.body.appendChild(sc);
    }

    return () => cleanups.forEach((fn) => fn());
  }, []);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="acel" dangerouslySetInnerHTML={{ __html: HTML }} />
    </>
  );
}
