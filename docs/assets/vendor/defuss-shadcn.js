/*! defuss-shadcn v0.9.14 | MIT | see licenses/Shadcn-MIT.txt */
var zi=Object.defineProperty,Ri=e=>e;function Di(e,t){this[e]=Ri.bind(null,t)}var Ii=(e,t)=>{for(var r in t)zi(e,r,{get:t[r],enumerable:!0,configurable:!0,set:Di.bind(t,r)})},Wo={};Ii(Wo,{CAPTURE_ONLY_EVENTS:()=>Vo,CLASS_ATTRIBUTE_NAME:()=>or,COMMENT_TYPE:()=>hr,DANGEROUSLY_SET_INNER_HTML_ATTRIBUTE:()=>ea,DEFAULT_TRANSITION_CONFIG:()=>_r,FROM_DOM_MARKER:()=>ht,REF_ATTRIBUTE_NAME:()=>Zo,XLINK_ATTRIBUTE_NAME:()=>br,XMLNS_ATTRIBUTE_NAME:()=>yr,applyStyles:()=>qe,areDomNodesEqual:()=>Xi,clearDelegatedEvents:()=>rr,clearDelegatedEventsDeep:()=>xt,domNodeToVNode:()=>vr,getMimeType:()=>Yo,getRegisteredEventKeys:()=>Xo,getRegisteredEventTypes:()=>Ui,getRenderer:()=>wt,getTransitionStyles:()=>ia,handleLifecycleEventsForOnMount:()=>ae,htmlStringToVNodes:()=>Qo,isCommentVNode:()=>He,isHTML:()=>Jo,isMarkup:()=>Vi,isSVG:()=>gr,morph:()=>cs,nsMap:()=>ct,observeUnmount:()=>gt,onClearDelegatedEvents:()=>Pi,parseDOM:()=>_t,parseEventPropName:()=>pr,performTransition:()=>sa,queueCallback:()=>st,registerDelegatedEvent:()=>Ho,removeDelegatedEvent:()=>qi,removeDelegatedEventByKey:()=>Ko,renderMarkup:()=>Hi,replaceDomWithVdom:()=>ns,resolveGlobals:()=>kt,updateDomWithVdom:()=>xr});var st=e=>(...t)=>queueMicrotask(()=>e(...t)),Vo=new Set(["focus","blur","scroll","mouseenter","mouseleave"]),ue=new WeakMap,ko=new WeakMap,Ao=new WeakMap,pr=e=>{if(!e.startsWith("on"))return null;let t=e.slice(2);if(!t)return null;let r=t.toLowerCase(),o=r.endsWith("capture"),a=o?r.slice(0,-7):r;return a?{eventType:a,capture:o}:null},Fi=e=>{let t=ue.get(e);if(t)return t;let r=new Map;return ue.set(e,r),r},ji=(e,t,r,o)=>{let a=ue.get(e)?.get(t)?.[r];if(!a)return;let n=`${t}:${r}`,i=Ao.get(e);if(!i?.has(n)){i||(i=new Set,Ao.set(e,i)),i.add(n);try{a.call(e,o)}finally{i.delete(n)}}},mr=(e,t,r,o,a)=>{o[r]=a;let n=`${t}:${r}`,i=r==="capture",s=ko.get(e),c=s?.get(n);if(a&&!c){s||(s=new Map,ko.set(e,s));let l=f=>ji(e,t,r,f);s.set(n,l),e.addEventListener(t,l,i)}else!a&&c&&(s.delete(n),e.removeEventListener(t,c,i))},We=(e,t,r,o)=>{mr(e,t,o,r,void 0);let a=o==="capture"?"captureSet":"bubbleSet";for(let n of r[a]??[])e.removeEventListener(t,n,o==="capture");r[a]=void 0},Ho=(e,t,r,o={})=>{let a=o.capture||Vo.has(t),n=a?"capture":"bubble",i=Fi(e),s=i.get(t)??{};if(i.set(t,s),o.multi){let c=a?"captureSet":"bubbleSet",l=s[c]??=new Set;l.has(r)||(l.add(r),e.addEventListener(t,r,a))}else mr(e,t,n,s,r)},Go=e=>!e.capture&&!e.bubble&&(!e.captureSet||e.captureSet.size===0)&&(!e.bubbleSet||e.bubbleSet.size===0),qi=(e,t,r,o={})=>{let a=ue.get(e);if(!a)return;let n=a.get(t);if(n){if(r)for(let i of["capture","bubble"])(i==="capture"?n.captureSet:n.bubbleSet)?.delete(r)&&e.removeEventListener(t,r,i==="capture"),n[i]===r&&mr(e,t,i,n,void 0);else We(e,t,n,"capture"),We(e,t,n,"bubble");Go(n)&&a.delete(t)}},tr=new Set,Pi=e=>(tr.add(e),()=>{tr.delete(e)}),rr=e=>{let t=ue.get(e);if(t){for(let[r,o]of t)We(e,r,o,"capture"),We(e,r,o,"bubble");t.clear()}for(let r of tr)r(e)},xt=e=>{rr(e);let t=e.ownerDocument;if(!t)return;let r=t.createTreeWalker(e,1),o=r.nextNode();for(;o;)rr(o),o=r.nextNode()},Ui=e=>{let t=ue.get(e);return t?new Set(t.keys()):new Set},Xo=e=>{let t=ue.get(e);if(!t)return new Set;let r=new Set;for(let[o,a]of t)(a.bubble||a.bubbleSet?.size)&&r.add(`${o}:bubble`),(a.capture||a.captureSet?.size)&&r.add(`${o}:capture`);return r},Ko=(e,t,r)=>{let o=ue.get(e);if(!o)return;let a=o.get(t);a&&(We(e,t,a,r),Go(a)&&o.delete(t))},ht=Symbol("defuss-morph.from-dom"),hr="#comment",He=e=>!!e&&typeof e=="object"&&e.type===hr,Bi=new Set(["allowfullscreen","async","autofocus","autoplay","checked","controls","default","defer","disabled","formnovalidate","hidden","inert","ismap","itemscope","loop","multiple","muted","nomodule","novalidate","open","playsinline","readonly","required","reversed","selected"]),Wi=e=>Bi.has(e.name.toLowerCase())?!0:e.value;function _t(e,t,r){return new r().parseFromString(e,t)}function gr(e,t){let r=_t(e,"image/svg+xml",t);return r.documentElement?r.documentElement.nodeName.toLowerCase()==="svg":!1}function Jo(e,t){return _t(e,"text/html",t).documentElement.querySelectorAll("*").length>2}var Vi=(e,t)=>e.indexOf("<")>-1&&e.indexOf(">")>-1&&(Jo(e,t)||gr(e,t));function Hi(e,t,r){let o=r||_t(e,Yo(e,t),t);return o.body?Array.from(o.body.childNodes):o.documentElement?[o.documentElement]:[]}function Yo(e,t){return gr(e,t)?"image/svg+xml":"text/html"}function vr(e){if(e.nodeType===3)return e.textContent||"";if(e.nodeType===1){let t=e,r={};for(let a=0;a<t.attributes.length;a++){let n=t.attributes[a];r[n.name]=Wi(n)}let o=[];for(let a=0;a<t.childNodes.length;a++){let n=vr(t.childNodes[a]);o.push(n)}return{type:t.tagName.toLowerCase(),attributes:{...r,[ht]:!0},children:o}}return e.nodeType===8?{type:hr,value:e.nodeValue??""}:""}var Gi=/^\s*(?:<!--[\s\S]*?-->\s*)*<(?:!doctype|html|head|body)[\s>/]/i;function Qo(e,t){let o=new t().parseFromString(Gi.test(e)?e:`<body>${e}`,"text/html"),a=[];for(let n=0;n<o.body.childNodes.length;n++){let i=vr(o.body.childNodes[n]);i!==""&&a.push(i)}return a}var or="class",br="xlink",yr="xmlns",Zo="ref",ea="dangerouslySetInnerHTML",ct={[yr]:"http://www.w3.org/2000/xmlns/",[br]:"http://www.w3.org/1999/xlink",svg:"http://www.w3.org/2000/svg"},gt=(e,t)=>{if(!e||typeof t!="function")throw new Error("Invalid arguments. Ensure domNode and onUnmount are valid.");if(typeof MutationObserver>"u")return;let r=e.parentNode;if(!r)throw new Error("The provided domNode does not have a parentNode.");let o=new MutationObserver(a=>{for(let n of a)if(n.removedNodes.length>0){for(let i of n.removedNodes)if(i===e){queueMicrotask(()=>{if(!e.isConnected){t(),o.disconnect();return}let s=e.parentNode;s&&s!==r&&(r=s,o.disconnect(),o.observe(r,{childList:!0}))});return}}});o.observe(r,{childList:!0})},ae=e=>{typeof e?.$onMount=="function"&&(e.$onMount(e),e.$onMount=null),typeof e?.$onUnmount=="function"&&gt(e,e.$onUnmount)},wt=e=>{let t={hasElNamespace:r=>r.namespaceURI===ct.svg,hasSvgNamespace:(r,o)=>t.hasElNamespace(r)&&o!=="STYLE"&&o!=="SCRIPT",createElementOrElements:(r,o)=>Array.isArray(r)?t.createChildElements(r,o):typeof r<"u"?t.createElement(r,o):t.createTextNode("",o),createElement:(r,o)=>{let a;if(He(r)){let n=e.createComment(r.value??"");return o?.appendChild(n),n}try{if(typeof r=="function"&&r.constructor.name==="AsyncFunction")a=e.createElement("div");else if(typeof r=="object"&&r!==null&&"type"in r){let n=r;typeof n.type=="function"?(a=e.createElement("div"),a.innerText=`FATAL ERROR: ${n.type._error}`):typeof n.type=="string"&&n.type.toUpperCase()==="SVG"||o&&t.hasSvgNamespace(o,typeof n.type=="string"?n.type.toUpperCase():"")?a=e.createElementNS(ct.svg,n.type):a=e.createElement(n.type),n.attributes&&(t.setAttributes(n,a),n.attributes.dangerouslySetInnerHTML&&(a.innerHTML=n.attributes.dangerouslySetInnerHTML.__html)),n.children&&!n.attributes?.dangerouslySetInnerHTML&&t.createChildElements(n.children,a)}else(typeof r=="string"||typeof r=="number")&&(a=e.createElement(String(r)));a&&o&&(o.appendChild(a),ae(a))}catch(n){throw console.error("Fatal error! Error happend while rendering the VDOM!",n,r),n}return a},createTextNode:(r,o)=>{let a=e.createTextNode(r.toString());return o&&o.appendChild(a),a},createChildElements:(r,o)=>{let a=[];for(let n=0;n<r.length;n++){let i=r[n];typeof i!="boolean"&&(i===null||typeof i!="object"&&typeof i!="function"?a.push(t.createTextNode((typeof i>"u"||i===null?"":i).toString(),o)):a.push(t.createElement(i,o)))}return a},setAttribute:(r,o,a)=>{if(typeof o>"u"||r===ea)return;if(r==="key"){a._defussKey=String(o);return}if(r===Zo&&typeof o!="function"){let s=o;s.current=a,a._defussRef=o,a.$onUnmount=st(()=>{}),a.parentNode?gt(a,a.$onUnmount):queueMicrotask(()=>{a.parentNode&&gt(a,a.$onUnmount)});return}let n=pr(r);if(n&&typeof o=="function"){let{eventType:s,capture:c}=n;if(s==="mount"){a.$onMount=st(o);return}if(s==="unmount"){if(a.$onUnmount){let l=a.$onUnmount;a.$onUnmount=()=>{l(),o()}}else a.$onUnmount=st(o);return}Ho(a,s,o,{capture:c});return}r==="className"&&(r=or),r===or&&Array.isArray(o)&&(o=o.filter(s=>!!s).join(" "));let i=r.match(/[A-Z]/)?.index;if(t.hasElNamespace(a)&&i){let s=r.substring(0,i).toLowerCase(),c=r.substring(i,r.length).toLowerCase(),l=ct[s]||null;a.setAttributeNS(l,s===br||s===yr?`${s}:${c}`:r,String(o))}else if(r==="style"&&typeof o!="string"){let s=o;for(let c of Object.keys(s))a.style[c]=String(s[c])}else typeof o=="boolean"?(a[r]=o,o?a.setAttribute(r,""):a.removeAttribute(r)):(r==="value"||r==="checked"||r==="selectedIndex")&&(a.nodeName==="INPUT"||a.nodeName==="TEXTAREA"||a.nodeName==="SELECT")?(a[r]=o,r==="checked"?o?a.setAttribute("checked",""):a.removeAttribute("checked"):r==="value"&&a.setAttribute("value",String(o))):a.setAttribute(r,String(o))},setAttributes:(r,o)=>{let a=Object.keys(r.attributes??{});for(let n=0;n<a.length;n++)t.setAttribute(a[n],r.attributes[a[n]],o)}};return t},Xi=(e,t)=>{if(e===t)return!0;if(e.nodeType!==t.nodeType)return!1;if(e.nodeType===1){let r=e,o=t;if(r.tagName!==o.tagName)return!1;let a=r.attributes,n=o.attributes;if(a.length!==n.length)return!1;for(let i=0;i<a.length;i++){let s=a[i],c=o.getAttribute(s.name);if(s.value!==c)return!1}}return!((e.nodeType===3||e.nodeType===8)&&e.nodeValue!==t.nodeValue)};function Ki(e){return typeof e=="string"||typeof e=="number"||typeof e=="boolean"}function ta(e){return!!(e&&typeof e=="object"&&"type"in e)}function Ji(e,t=!1){if(e==null||Ki(e)||ta(e)||t&&e&&typeof e=="object"&&"attributes"in e)return e}function Yi(e,t=!1){let r=[],o=s=>{if(Array.isArray(s)){s.forEach(o);return}let c=Ji(s,t);if(!(typeof c>"u")){if(ta(c)&&(c.type==="fragment"||c.type==="Fragment")){(Array.isArray(c.children)?c.children:[]).forEach(o);return}c===null||typeof c>"u"||typeof c=="boolean"||r.push(c)}};o(e);let a=[],n=null,i=()=>{n!==null&&n.length>0&&a.push(n),n=null};for(let s of r){if(typeof s=="string"||typeof s=="number"||typeof s=="boolean"){n=(n??"")+String(s);continue}i(),a.push(s)}return i(),a}function ra(e){if(!e||typeof e!="object")return null;let t=e.attributes?.key;if(typeof t=="string"||typeof t=="number")return`k:${String(t)}`;let r=e.attributes?.id;return typeof r=="string"&&r.length>0?`id:${r}`:null}function Qi(e){return e&&typeof e=="object"?`<${typeof e.type=="string"?e.type:"component"}>`:"plain text"}function oa(e){if(e.nodeType!==1)return[];let t=e,r=[],o=t._defussKey;o&&r.push(`k:${o}`);let a=t.getAttribute("key");a&&r.push(`k:${a}`);let n=t.id;return n&&r.push(`id:${n}`),r}function Zi(e,t){if(typeof t=="string"||typeof t=="number"||typeof t=="boolean")return e.nodeType===3;if(He(t))return e.nodeType===8;if(t&&typeof t=="object"){if(e.nodeType!==1)return!1;let o=e.tagName.toLowerCase(),a=typeof t.type=="string"?t.type.toLowerCase():"";return!(!a||o!==a)}return!1}function vt(e,t){let r=wt(t.window.document);if(e==null)return;if(typeof e=="string"||typeof e=="number"||typeof e=="boolean")return[t.window.document.createTextNode(String(e))];let o=r.createElementOrElements(e);return o?(Array.isArray(o)?o:[o]).filter(Boolean):void 0}function es(e,t,r){let o=e.tagName.toLowerCase();return Object.hasOwn(r.attributes??{},t)?!1:o==="input"?t==="value"||t==="checked":o==="textarea"||o==="select"?t==="value":!1}function ts(e,t,r,o=!1){let a=wt(r.window.document),n=o?[]:Array.from(e.attributes),i=t.attributes??{};for(let f of n){let{name:u}=f;if(u!=="key"&&!u.startsWith("on")&&!(u==="class"&&(Object.hasOwn(i,"class")||Object.hasOwn(i,"className")))&&!Object.hasOwn(i,u)){if(es(e,u,t))continue;e.removeAttribute(u)}}if(!(o||!!i[ht])){let f=Xo(e),u=new Set;for(let g of Object.keys(i)){let d=pr(g);if(d){let p=d.capture?"capture":"bubble";u.add(`${d.eventType}:${p}`)}}for(let g of f)if(!u.has(g)){let[d,p]=g.split(":");Ko(e,d,p)}}a.setAttributes(t,e),ae(e);let c=t.attributes?.dangerouslySetInnerHTML;if(c&&typeof c=="object"&&typeof c.__html=="string"){e.innerHTML=c.__html;return}if(e.tagName.toLowerCase()==="textarea"){let f=Object.hasOwn(i,"value");if(e.ownerDocument?.activeElement===e&&!f)return}o&&(t.children===void 0||t.children.length===0&&i[ht])||na(e,t.children??[],r)}function Kt(e,t){e.nodeType===1&&xt(e),e.parentNode?.replaceChild(t,e)}function aa(e,t,r,o=!1){if(typeof t=="string"||typeof t=="number"||typeof t=="boolean"){let a=String(t);if(e.nodeType===3)return e.nodeValue!==a&&(e.nodeValue=a),e;let n=r.window.document.createTextNode(a);return Kt(e,n),n}if(He(t)){let a=t.value??"";if(e.nodeType===8)return e.nodeValue!==a&&(e.nodeValue=a),e;let n=r.window.document.createComment(a);return Kt(e,n),n}if(t&&typeof t=="object"){let a=typeof t.type=="string"?t.type:null;if(!a)return e;if(e.nodeType!==1){let c=vt(t,r),l=Array.isArray(c)?c[0]:c;return l?(e.parentNode?.replaceChild(l,e),ae(l),l):null}let n=e,i=n.tagName.toLowerCase(),s=a.toLowerCase();if(i!==s){let c=vt(t,r),l=Array.isArray(c)?c[0]:c;return l?(Kt(n,l),ae(l),l):null}return ts(n,t,r,o),n}return e.nodeType===1&&xt(e),e.parentNode?.removeChild(e),null}var lt=new WeakSet,ft=new Map,kt=(e,t)=>t||{window:e?.ownerDocument?.defaultView??globalThis};function rs(e){let t=e.parentElement;for(;t;){if(lt.has(t))return!0;t=t.parentElement}return!1}function os(){if(ft.size===0)return;let e=[...ft.entries()];ft.clear();for(let[t,{vdom:r,globals:o,mode:a}]of e)t.isConnected&&xr(t,r,o,a)}function xr(e,t,r,o="replace"){let a=kt(e,r);if(lt.has(e)||rs(e)){ft.set(e,{vdom:t,globals:a,mode:o});return}lt.add(e);try{na(e,t,a,o)}finally{lt.delete(e)}os()}function as(e,t,r){let o=new Map;for(let a of Array.from(e.childNodes))for(let n of oa(a))o.has(n)||o.set(n,a);for(let a of t){if(typeof a=="string"&&a.trim()===""||He(a))continue;let n=ra(a);if(!n)throw new Error(`morph diff: patch items must be elements with a key or id attribute (got ${Qi(a)})`);let i=o.get(n);if(i){let c=a&&typeof a=="object"&&!a.type?{...a,type:i.tagName.toLowerCase()}:a;aa(i,c,r,!0);continue}if(!a?.type)throw new Error(`morph diff: new (unmatched) patch items must declare a tag (type), got key/id "${n}"`);let s=vt(a,r)??[];for(let c of s)e.appendChild(c),ae(c)}}function na(e,t,r,o="replace"){let a=e,n=a.tagName.includes("-"),i=a.shadowRoot&&!n?a.shadowRoot:e,s=Yi(t,o==="diff");if(o==="diff"){as(i,s,r);return}let c=Array.from(i.childNodes),l=new Map,f=new WeakMap,u=[];for(let m of c){let h=oa(m);if(h.length>0){f.set(m,h);let y=!1;for(let v of h)l.has(v)||(l.set(v,m),y=!0);y||u.push(m)}else u.push(m)}let g=m=>{let h=f.get(m)??[];for(let y of h)l.delete(y)},d=m=>{for(let h=0;h<u.length;h++){let y=u[h];if(Zi(y,m))return u.splice(h,1),y}},p=0;for(let m of s){let h=ra(m),y;h?(y=l.get(h),y&&g(y)):y=d(m);let v=i.childNodes[p]??null;if(y){y!==v&&i.insertBefore(y,v),aa(y,m,r),p++;continue}let _=vt(m,r);if(!_||Array.isArray(_)&&_.length===0)continue;let w=Array.isArray(_)?_:[_];for(let E of w)i.insertBefore(E,v),ae(E),p++}let x=new Set;for(let m of u)x.add(m);for(let m of l.values())x.add(m);for(let m of x)m.parentNode===i&&(m.nodeType===1&&xt(m),i.removeChild(m))}function ns(e,t,r){let o=kt(e,r);for(;e.firstChild;)e.removeChild(e.firstChild);let n=wt(o.window.document).createElementOrElements(t);if(Array.isArray(n))for(let i of n)i&&(e.appendChild(i),ae(i));else n&&(e.appendChild(n),ae(n))}var is=e=>{if(e&&!e.getElementById("defuss-shake")){let t=e.createElement("style");t.id="defuss-shake",t.textContent="@keyframes shake{0%,100%{transform:translate3d(0,0,0)}10%,30%,50%,70%,90%{transform:translate3d(-10px,0,0)}20%,40%,60%,80%{transform:translate3d(10px,0,0)}}",e.head.appendChild(t)}},ia=(e,t,r="ease-in-out")=>{let o=`transform ${t}ms ${r}, opacity ${t}ms ${r}`;return{fade:{enter:{opacity:"0",transition:o,transform:"translate3d(0,0,0)"},enterActive:{opacity:"1"},exit:{opacity:"1",transition:o,transform:"translate3d(0,0,0)"},exitActive:{opacity:"0"}},"slide-left":{enter:{transform:"translate3d(100%,0,0)",opacity:"0.5",transition:o},enterActive:{transform:"translate3d(0,0,0)",opacity:"1"},exit:{transform:"translate3d(0,0,0)",opacity:"1",transition:o},exitActive:{transform:"translate3d(-100%,0,0)",opacity:"0.5"}},"slide-right":{enter:{transform:"translate3d(-100%,0,0)",opacity:"0.5",transition:o},enterActive:{transform:"translate3d(0,0,0)",opacity:"1"},exit:{transform:"translate3d(0,0,0)",opacity:"1",transition:o},exitActive:{transform:"translate3d(100%,0,0)",opacity:"0.5"}},shake:(is(typeof document<"u"?document:void 0),{enter:{transform:"translate3d(0,0,0)",opacity:"1",transition:"none"},enterActive:{transform:"translate3d(0,0,0)",opacity:"1",animation:`shake ${t}ms cubic-bezier(0.36,0.07,0.19,0.97)`},exit:{transform:"translate3d(0,0,0)",opacity:"1",transition:"none"},exitActive:{transform:"translate3d(0,0,0)",opacity:"1",animation:`shake ${t}ms cubic-bezier(0.36,0.07,0.19,0.97)`}})}[e]||{enter:{},enterActive:{},exit:{},exitActive:{}}},qe=(e,t)=>Object.entries(t).forEach(([r,o])=>e.style.setProperty(r,String(o))),_r={type:"fade",duration:300,easing:"ease-in-out",delay:0,target:"parent"},ut=e=>new Promise(t=>setTimeout(t,e)),ss=async(e,t,r,o)=>{let a=e.style.cssText,n=e.cloneNode(!0),i=e.ownerDocument;try{let s=e.getBoundingClientRect();n.style.cssText=`position:absolute;top:${s.top}px;left:${s.left}px;width:${s.width}px;height:${s.height}px;opacity:1;transition:opacity ${r}ms ${o};z-index:1000;`,e.style.opacity="0",e.style.transition=`opacity ${r}ms ${o}`,i.body.appendChild(n),await t(),e.offsetHeight,n.style.opacity="0",e.style.opacity="1",await ut(r),i.body.removeChild(n)}catch(s){throw n.parentElement&&i.body.removeChild(n),s}finally{e.style.cssText=a}},sa=async(e,t,r={})=>{let{type:o="fade",duration:a=300,easing:n="ease-in-out",delay:i=0}={..._r,...r};if(o==="none"){await t();return}if(i>0&&await ut(i),o==="fade"){await ss(e,t,a,n);return}let s=r.styles||ia(o,a,n),c=e.style.transition,l=e.style.animation;try{o==="shake"&&(e.style.animation="none",e.offsetHeight),qe(e,s.exit),e.offsetHeight,qe(e,s.exitActive),await ut(a),await t(),qe(e,s.enter),e.offsetHeight,qe(e,s.enterActive),await ut(a),e.style.transition=c,e.style.animation=l}catch(f){throw e.style.transition=c,e.style.animation=l,f}},De=new WeakMap,cs=(e,t,r={})=>{let o=kt(e),a=o.window,n=r.diff?"diff":"replace",i=l=>xr(e,typeof l=="string"?Qo(l,a.DOMParser):l,o,n),s=r.transition;if(s&&s.type!=="none"){let l={..._r,...s},f=l.target==="self"?e:e.parentElement;if(!f){i(t);return}let u={content:t};return De.set(e,u),sa(f,async()=>{De.get(e)===u&&i(u.content)},l).finally(()=>{De.get(e)===u&&De.delete(e)})}let c=De.get(e);c&&(c.content=t),i(t)},J=e=>!!e&&typeof e=="object"&&typeof e.nodeType=="number",P=e=>J(e)&&e.nodeType===1,Eo=e=>!!e&&typeof e.addEventListener=="function",fe=e=>{let t=e?.document??(J(e)?e.nodeType===9?e:e.ownerDocument:void 0)??globalThis.document;if(!t)throw new Error("defuss-query: a DOM document or explicit context is required");return t},K=e=>Array.from(e).filter(P),Ie=e=>(typeof e=="string"?e:e.join(" ")).split(/\s+/).filter(Boolean),ar=e=>!e.localName.includes("-")&&e.shadowRoot?e.shadowRoot:e;function ls(e){let t=()=>{if(typeof e.morph!="function"||typeof e.getRenderer!="function")throw new Error("defuss-query: load defuss-morph before creating or mutating DOM")};function r(f,u){t();let d=fe(u).defaultView?.DOMParser;if(!d)throw new Error("defuss-query: context document has no DOMParser");let p=/^\s*(?:<!--[\s\S]*?-->\s*)*<([a-z][\w:-]*)/i.exec(f)?.[1].toLowerCase(),m={tr:["table","tbody"],td:["table","tbody","tr"],th:["table","tbody","tr"],tbody:["table"],thead:["table"],tfoot:["table"],caption:["table"],colgroup:["table"],col:["table","colgroup"],option:["select"],optgroup:["select"]}[p??""]??[],h=f;for(let v=m.length-1;v>=0;v--)h=`<${m[v]}>${h}</${m[v]}>`;let y=e.htmlStringToVNodes(`<body>${h}</body>`,d);for(let v of m)y=y.find(w=>!!w&&typeof w=="object"&&w.type===v)?.children??[];return y}function o(f,u,g=!1){return t(),J(f)?f.nodeType===11?Array.from(f.childNodes).flatMap(d=>o(d,u,g)):[g?f.cloneNode(!0):f]:typeof f=="string"?r(f,u).flatMap(d=>a(d,u)):f&&typeof f=="object"&&!("type"in f)&&(Symbol.iterator in f||"length"in f)?Array.from(f).flatMap(d=>o(d,u,g)):a(f,u)}function a(f,u){if(f==null||typeof f=="boolean")return[];if(Array.isArray(f))return f.flatMap(p=>a(p,u));let g=e.getRenderer(fe(u));if(typeof f=="string"||typeof f=="number")return[g.createTextNode(String(f))];let d=f;if(d.type==="fragment"||d.type==="Fragment")return a(d.children??[],u);if(typeof d.type!="string")throw new TypeError("defuss-query: expected an intrinsic VNode with a string type");if(P(u)&&u.namespaceURI==="http://www.w3.org/2000/svg"&&d.type!=="svg"){let p=g.createElement({type:"svg"});return[g.createElement(d,p)]}return[g.createElement(d)]}function n(f){t(),P(f)&&e.clearDelegatedEventsDeep(f),f.parentNode?.removeChild(f)}function i(f,u,g="beforeend",d=!1){t();let x=g==="afterbegin"||g==="beforeend"?P(f)?ar(f):f:f.parentNode;if(!x)return[];let m=g==="afterbegin"?x.firstChild:g==="beforebegin"?f:g==="afterend"?f.nextSibling:null,h=o(u,P(x)||x.nodeType===11?x:fe(x),d);for(let y of h)if(y===x||y.contains(x))throw new DOMException("Cannot insert an ancestor into its descendant","HierarchyRequestError");for(let y of h)x.insertBefore(y,m),P(y)&&e.handleLifecycleEventsForOnMount(y);return h}function s(f,u,g=!1){if(!f.parentNode)return[];let d=o(u,f.parentNode,g);if(d.includes(f)){if(d.length===1)return d;throw new TypeError("defuss-query: replacement containing its target must contain only that target")}let p=i(f,d,"beforebegin");return n(f),p}function c(f,u,g){t();let d=p=>J(p)?p.nodeType===11?Array.from(p.childNodes,x=>e.domNodeToVNode(x)):e.domNodeToVNode(p):Array.isArray(p)?p.map(d):p;return e.morph(f,typeof u=="string"?r(u,f):d(u),g)}function l(f,u){t(),P(f)?c(f,[u]):(f.nodeType===3||f.nodeType===4)&&(f.nodeValue=u)}return{create:o,insert:i,replace:s,remove:n,morph:c,text:l}}var ca,fs="0.2.0",us=Symbol.for("defuss-query.factory"),Be=new WeakMap,la=(e,t,r)=>{let o=Be.get(e);if(!o)return;let a=o.filter(n=>{let i=(!t||t.includes(n.type))&&(!r||n.handler===r);return i&&e.removeEventListener(n.type,n.handler,n.capture),!i});a.length?Be.set(e,a):Be.delete(e)},ds=e=>la(e),Jt=e=>e.startsWith("--")?e:e.replace(/[A-Z]/g,t=>`-${t.toLowerCase()}`),To=e=>e,Z=class extends Array{static get[Symbol.species](){return Array}#e;constructor(t,r=[]){super(),this.#e=t;for(let o of new Set(Array.from(r)))this.push(o)}#t(t){return new ca(this.#e,t)}#o(t){return this.#t(K(this).flatMap(r=>Array.from(t(r)).filter(P)))}#a(){return P(this[0])?this[0]:void 0}get(t){return t===void 0?Array.from(this):this.at(t)}toArray(){return Array.from(this)}eq(t){let r=this.at(t);return this.#t(r===void 0?[]:[r])}first(){return this.eq(0)}last(){return this.eq(-1)}each(t){for(let r=0;r<this.length&&t.call(this[r],r,this[r])!==!1;r++);return this}find(t,r){return typeof t=="function"?super.find(t,r):this.#t(Array.from(this).flatMap(o=>"querySelectorAll"in o?Array.from(o.querySelectorAll(t)):[]))}filter(t,r){return this.#t(super.filter(typeof t=="string"?o=>P(o)&&o.matches(t):t,r))}is(t){return this.some(r=>P(r)&&r.matches(t))}parent(){return this.#o(t=>[t.parentElement])}children(t){let r=this.#t(Array.from(this).flatMap(o=>"children"in o?Array.from(o.children):[]));return t===void 0?r:r.filter(t)}closest(t){return this.#o(r=>[r.closest(t)])}next(){return this.#o(t=>[t.nextElementSibling])}prev(){return this.#o(t=>[t.previousElementSibling])}attr(t,r){if(arguments.length===1)return this.#a()?.getAttribute(t);for(let o of K(this))r===null?o.removeAttribute(t):o.setAttribute(t,String(r));return this}prop(t,r){if(arguments.length===1)return this[0]?To(this[0])[t]:void 0;if(["innerHTML","outerHTML","textContent","innerText"].includes(t))throw new TypeError("defuss-query: use html(), text(), or replaceWith() for structural writes");for(let o of this)To(o)[t]=r;return this}data(t,r){let o=this.#a();if(arguments.length===1)return o?.dataset&&Object.hasOwn(o.dataset,t)?o.dataset[t]:void 0;for(let a of K(this))a.dataset&&(r===null?delete a.dataset[t]:a.dataset[t]=String(r));return this}css(t,r){if(typeof t=="string"&&arguments.length===1){let a=this.#a();return a?a.ownerDocument.defaultView?.getComputedStyle(a).getPropertyValue(Jt(t)):void 0}let o=typeof t=="string"?[[t,r]]:Object.entries(t);for(let a of K(this))for(let[n,i]of o)a.style&&(i===null?a.style.removeProperty(Jt(n)):a.style.setProperty(Jt(n),String(i)));return this}addClass(t){let r=Ie(t);for(let o of K(this))o.classList.add(...r);return this}removeClass(t){let r=t===void 0?void 0:Ie(t);for(let o of K(this))r?o.classList.remove(...r):o.removeAttribute("class");return this}toggleClass(t,r){let o=Ie(t);for(let a of K(this))for(let n of o)r===void 0?a.classList.toggle(n):a.classList.toggle(n,r);return this}hasClass(t){return K(this).some(r=>r.classList.contains(t))}val(t){let r=K(this).filter(o=>"value"in o);if(arguments.length===0){let o=r[0];return o?.localName==="select"&&o.multiple?Array.from(o.selectedOptions,a=>a.value):o?.value}for(let o of r)if(o.localName==="select"&&o.multiple){let a=new Set(Array.isArray(t)?t:t==null?[]:[String(t)]);for(let n of o.options)n.selected=a.has(n.value)}else o.localName==="input"&&["checkbox","radio"].includes(o.type)&&Array.isArray(t)?o.checked=t.includes(o.value):o.value=Array.isArray(t)?t[0]??"":t==null?"":String(t);return this}form(t){if(this.length!==1||!P(this[0])||this[0].localName!=="form")throw new TypeError("defuss-query: form() requires exactly one form element");let r=this[0],o=r.ownerDocument.defaultView?.FormData;if(!o)throw new Error("defuss-query: form document has no FormData");return new o(r,t)}serialize(t){let r=new URLSearchParams;for(let[o,a]of this.form(t))typeof a=="string"&&r.append(o,a);return r.toString()}morph(t,r){if(r?.transition!==void 0)return Promise.all(K(this).map(async o=>{await this.#e.dom.morph(o,t,r)})).then(()=>this);for(let o of K(this))this.#e.dom.morph(o,t,r);return this}html(t,r){if(arguments.length===0){let o=this.#a();return o?ar(o).innerHTML:void 0}return this.morph(t,r)}text(t){if(arguments.length===0)return Array.from(this,r=>J(r)?(P(r)?ar(r):r).textContent??"":"").join("");for(let r of this)J(r)&&this.#e.dom.text(r,t==null?"":String(t));return this}empty(){return this.morph([])}#r(t,r,o=!1){let a=J(t)&&t.nodeType===11?Array.from(t.childNodes):t&&typeof t=="object"&&!J(t)&&!("type"in t)&&(Symbol.iterator in t||"length"in t)?Array.from(t):t,n=Array.from(this).filter(i=>J(i)).filter(i=>r==="afterbegin"||r==="beforeend"?i.nodeType===1||i.nodeType===11:!!i.parentNode);return n.flatMap((i,s)=>o?this.#e.dom.replace(i,a,s!==n.length-1):this.#e.dom.insert(i,a,r,s!==n.length-1))}append(t){return this.#r(t,"beforeend"),this}prepend(t){return this.#r(t,"afterbegin"),this}before(t){return this.#r(t,"beforebegin"),this}after(t){return this.#r(t,"afterend"),this}replaceWith(t){return this.#r(t,"beforebegin",!0),this}appendTo(t){let r=typeof t=="string"?this.#e.api(t,fe(this[0])):this.#e.api(t);return this.#t(r.#r(this,"beforeend"))}remove(){for(let t of Array.from(this).filter(r=>J(r)))this.#e.dom.remove(t);return this}on(t,r,o={}){if(typeof r!="function")throw new TypeError("defuss-query: on() requires a function");if(typeof o=="object"&&Object.keys(o).some(n=>n!=="capture"))throw new TypeError("defuss-query: on() supports capture only; use native addEventListener for other options");let a=typeof o=="boolean"?o:!!o.capture;for(let n of this)for(let i of Ie(t)){let s=r;if(P(n)){if(typeof this.#e.api.registerDelegatedEvent!="function")throw new Error("defuss-query: load defuss-morph before on()");this.#e.api.onClearDelegatedEvents?.(ds)}n.addEventListener(i,s,a);let c=Be.get(n)??[];c.some(l=>l.type===i&&l.handler===s&&l.capture===a)||c.push({type:i,handler:s,capture:a}),Be.set(n,c)}return this}off(t,r){let o=t===void 0?void 0:Ie(t);for(let a of this)la(a,o,r);return this}trigger(t,r){for(let o of this){let n=(J(o)?fe(o).defaultView:o.window===o?o:globalThis)?.CustomEvent??globalThis.CustomEvent;o.dispatchEvent(new n(t,{detail:r,bubbles:!0,cancelable:!0}))}return this}};ca=Z;function ps(e){let t=function(o,a){if(o==null||o==="")return new Z(r);if(typeof o=="function"){let n=fe(a),i=()=>o(t);return n.readyState==="loading"?n.addEventListener("DOMContentLoaded",i,{once:!0}):queueMicrotask(i),new Z(r,[n])}if(typeof o=="string"){let n=a??fe();return new Z(r,o.trimStart().startsWith("<")?r.dom.create(o,n):n.querySelectorAll(o))}if(Eo(o))return new Z(r,[o]);if(typeof o=="object"&&"type"in o)return new Z(r,r.dom.create(o,a??fe()));if(typeof o=="object"&&(Symbol.iterator in o||"length"in o)){let n=Array.from(o);if(!n.every(Eo))throw new TypeError("defuss-query: collections must contain EventTargets");return new Z(r,n)}throw new TypeError("defuss-query: expected selector, markup, VNode, EventTarget, or target collection")};for(let o of Reflect.ownKeys(e))["name","length","prototype","caller","arguments","fn","dom","queryVersion"].includes(String(o))||Object.defineProperty(t,o,{value:Reflect.get(e,o),writable:!0,enumerable:!0,configurable:!0});let r={api:t,dom:ls(t)};return Object.defineProperties(t,{fn:{value:Z.prototype},dom:{value:r.dom},queryVersion:{value:fs},[us]:{value:!0}}),t}function fa(e,t){let r,o,a=()=>{r=void 0;let i=o;o=void 0,i&&e(...i)},n=(...i)=>{o=i,r!==void 0&&clearTimeout(r),r=setTimeout(a,t)};return n.flush=()=>{r!==void 0&&(clearTimeout(r),a())},n.cancel=()=>{r!==void 0&&(clearTimeout(r),r=void 0,o=void 0)},n}var ms=2097152,hs=65536;function gs(e,t=ms){let r=0,o=new Set,a=(n,i)=>{if(++r>2e4||i>96)throw new Error("math data exceeds the node or depth limit");if(n===null||typeof n=="string"||typeof n=="boolean")return;if(typeof n=="number"){if(!Number.isFinite(n))throw new Error("math data holds a non-finite number");return}if(typeof n!="object"||o.has(n))throw new Error("math data must be acyclic JSON");let s=Object.getPrototypeOf(n);if(!Array.isArray(n)&&s!==Object.prototype&&s!==null)throw new Error("math data must hold plain objects");o.add(n);for(let[c,l]of Object.entries(n)){if(c==="__proto__"||c==="prototype"||c==="constructor")throw new Error(`math data key "${c}"`);a(l,i+1)}o.delete(n)};if(a(e,0),new TextEncoder().encode(JSON.stringify(e)).length>t)throw new Error("math data exceeds the size limit");return structuredClone(e)}function vs(e){if(typeof e!="string"||new TextEncoder().encode(e).length>hs)throw new Error("TeX must be a string of at most 65,536 bytes");return e}var bs=["morph","getRenderer","htmlStringToVNodes","renderMarkup","domNodeToVNode","registerDelegatedEvent","clearDelegatedEventsDeep","handleLifecycleEventsForOnMount"],ys="defuss-shadcn: runtime incomplete; load core before component scripts, or load all alone";function N(){let e=Reflect.get(globalThis,"df$");if(typeof e=="function"){let t=Reflect.get(e,"fn");if(typeof Reflect.get(e,"queryVersion")=="string"&&typeof t=="object"&&t!==null&&typeof Reflect.get(t,"morph")=="function"&&bs.every(r=>typeof Reflect.get(e,r)=="function"))return e}throw new Error(ys)}var ua=["subtitles","captions","descriptions"],I=(e,t)=>{let r=typeof e=="number"?e:parseFloat(String(e));return Number.isFinite(r)?r:t},Yt=e=>String(e).padStart(2,"0"),ge=e=>String(e??"").replace(/[&<>"']/g,t=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[t]),U=(e,t,r)=>{e.getAttribute(t)!==r&&N()(e).attr(t,r)};function Pe(e,t=e){let r=Number.isFinite(e)&&e>0?Math.floor(e+1e-6):0,o=Math.floor(r/3600),a=Math.floor(r%3600/60);return o>0||Number.isFinite(t)&&t>=3600?`${o}:${Yt(a)}:${Yt(r%60)}`:`${a}:${Yt(r%60)}`}function ne(e){return e?e instanceof HTMLMediaElement?e:N()(e).find("video, audio").get(0)??null:null}function At(e,t,r=!0){let o=N(),a=`[data-${t}-action], [data-${t}-output]`,n=r?o(e).find(a).toArray():[];if(e.id)for(let i of o(`[data-${t}-for="${CSS.escape(e.id)}"]`).toArray())i.matches(a)&&n.push(i),n.push(...o(i).find(a).toArray());return n}function xs(e,t){let r=e.closest(`[data-${t}-for], .${t}`);if(!r)return null;let o=r.getAttribute(`data-${t}-for`);return o===null?r:N()(`#${CSS.escape(o)}`).get(0)??null}function da(e){let t=ne(e);return{playing:!!t&&!t.paused&&!t.ended,config:{time:t?t.currentTime:0,duration:t&&Number.isFinite(t.duration)?t.duration:0,rate:t?t.playbackRate:1,volume:t?t.volume:1,muted:t?t.muted:!1,captions:t?_s(e,t):""}}}function _s(e,t){return e._mediaCaptions===!1||!e._mediaTrack?"":kr(t).find(r=>r.track===e._mediaTrack)?.key??""}function wr(e,t,r,o=!0){if(typeof VTTCue>"u")return[];let a=e._mediaTexts??=new Map,n=e._mediaRetired??=new WeakSet,i=(Array.isArray(t)?t:[]).filter(u=>u&&u.id!=null&&Array.isArray(u.items)),s=new Set(i.map(u=>String(u.id))),c=u=>{for(let g of u.cues)u.track.removeCue(g);u.cues=[],u.track.mode!=="disabled"&&(u.track.mode="disabled")};if(o)for(let[u,g]of a)g.owner===r&&!g.retired&&!s.has(u)&&(c(g),g.retired=!0);let l=kr(e).some(u=>u.track.mode!=="disabled"),f=[];for(let u of i){let g=String(u.id),d=ua.includes(String(u.kind))?String(u.kind):"subtitles",p=a.get(g);p&&p.kind!==d&&(c(p),n.add(p.track),a.delete(g),p=void 0),p?.retired&&(p.retired=!1,f.push({k:p,first:!!u.default})),p?p.owner=r:(p={track:e.addTextTrack(d,String(u.label??g),String(u.lang??"")),owner:r,kind:d,label:"",lang:"",cues:[]},p.track.mode="disabled",a.set(g,p),f.push({k:p,first:!!u.default})),p.label=String(u.label??g),p.lang=String(u.lang??"");for(let x of p.cues)p.track.removeCue(x);p.cues=[];for(let x of u.items){let m=I(x?.start,NaN),h=I(x?.end,NaN),y=String(x?.text??x?.label??"");if(Number.isFinite(m)&&Number.isFinite(h)&&h>m&&y){let v=new VTTCue(m,h,y);p.track.addCue(v),p.cues.push(v)}}}return!l&&f.length&&((f.find(u=>u.first)??f[0]).k.track.mode="showing"),[...s]}function kr(e){let t=e._mediaTexts??new Map,r=e._mediaRetired,o=new Map;for(let[i,s]of t)o.set(s.track,i);let a=new Set(t.keys()),n=[];return Array.from(e.textTracks).forEach((i,s)=>{if(!ua.includes(i.kind)||r?.has(i))return;let c=o.get(i);if(c!==void 0){let u=t.get(c);u.retired||n.push({key:c,kind:i.kind,label:u.label,lang:u.lang,track:i});return}let l=i.id||i.language||i.label||`track-${s+1}`,f=l;for(let u=2;a.has(f);u++)f=`${l}-${u}`;a.add(f),n.push({key:f,kind:i.kind,label:i.label||f,lang:i.language,track:i})}),n}function Ar(e,t,r,o,a=N()(e).find(`[data-${t}-action]`).toArray()){let n=N(),i=(c,l)=>U(c,"aria-pressed",l?"true":"false");for(let c of a){let l=c.getAttribute(`data-${t}-action`);if(l==="toggle")i(c,r==="playing");else if(l==="mute"&&o.muted!==void 0)i(c,!!o.muted);else if(l==="captions"&&o.captions!==void 0)i(c,o.captions!==""&&o.captions!==!1);else if(l==="volume"&&o.volume!==void 0&&c instanceof HTMLInputElement)U(c,"value",String(o.volume)),c.value!==String(o.volume)&&(c.value=String(o.volume));else if(l==="rate"&&o.rate!==void 0)if(c instanceof HTMLSelectElement)for(let f of Array.from(c.options)){let u=I(f.value,NaN)===o.rate;U(f,"selected",u?"":null),u&&c.value!==f.value&&(c.value=f.value)}else c.hasAttribute("data-value")&&i(c,I(c.getAttribute("data-value"),NaN)===o.rate)}let s=e instanceof HTMLMediaElement?e:n(e).find("video, audio").get(0);s&&o.muted!==void 0&&U(s,"muted",o.muted?"":null)}function bt(e,t){let r=N()(e).find(`.${t}-captions`);if(!r.length)return;let o=e._mediaTrack,a=ne(e)?.currentTime??0,n=e._mediaCaptions!==!1&&o?.cues?Array.from(o.cues).filter(i=>i.startTime<=a&&a<i.endTime).map(i=>(i.text??"").replace(/<[^>]+>/g,"")).join(`
`):"";r.text()!==n&&r.text(n)}function Ee(e,t){let r=ne(e);if(!r)return;let o=kr(r),a=e._mediaWanted?o.find(c=>c.key===e._mediaWanted):void 0;a&&(e._mediaWanted=void 0);let n=o.filter(c=>c.track.mode==="showing").pop(),i=a??n??o.find(c=>c.track===e._mediaTrack)??o[0];e._mediaTrack=i?.track;for(let c of o){let l=c===i&&e._mediaCaptions!==!1?"hidden":"disabled";c.track.mode!==l&&(c.track.mode=l)}let s=e._mediaTrack;s&&!(e._mediaCued??=new WeakSet).has(s)&&(e._mediaCued.add(s),s.addEventListener("cuechange",()=>bt(e,t))),bt(e,t),ks(e,t,o)}var ws=e=>({off:"Off",subtitles:"Subtitles",descriptions:"Video captions",...e._mediaLabels}),Qt=(e,t,r="")=>`<button class="dropdown-item dropdown-radio" role="menuitemradio" aria-checked="false" tabindex="-1" data-value="${ge(e)}">${ge(t)}${r}</button>`;function ks(e,t,r){let o=N(),a=e._mediaCaptions===!1?"":r.find(l=>l.track===e._mediaTrack)?.key??"",n=ws(e),i=r.filter(l=>l.kind!=="descriptions"),s=r.filter(l=>l.kind==="descriptions"),c=Qt("",n.off);for(let[l,f]of[[n.subtitles,i],[n.descriptions,s]])f.length&&(c+='<div class="dropdown-separator" role="separator"></div>',c+=f.length===1?Qt(f[0].key,l,`<span class="dropdown-shortcut">${ge(f[0].label)}</span>`):`<div class="dropdown-sub"><button class="dropdown-item dropdown-sub-trigger" role="menuitem" tabindex="-1">${ge(l)}<span class="dropdown-shortcut" data-${t}-menu-current></span></button><div class="dropdown-content dropdown-sub-content" role="menu" popover aria-label="${ge(l)}" data-size="sm">${f.map(u=>Qt(u.key,u.label)).join("")}</div></div>`);for(let l of At(e,t)){if(l.getAttribute(`data-${t}-action`)!=="captions")continue;let f=l._mediaMenu;if(r.length<2){if(f)for(let u of["popovertarget","aria-haspopup","aria-controls","aria-expanded"])U(l,u,null);continue}if(!f){let u=`${l.id||e.id||t}-captions-menu`;for(let d=2;o(`#${CSS.escape(u)}`).length;d++)u=`${l.id||e.id||t}-captions-menu-${d}`;f=o(`<div class="dropdown-content" role="menu" popover id="${ge(u)}" data-size="sm" data-align="end" aria-label="${ge(l.getAttribute("aria-label")??"Captions")}"></div>`).get(0),l._mediaMenu=f;let g=d=>{if(!d||!d.hasAttribute("data-value")||!e.api)return;let p=ne(e);e.api.setState(p&&!p.paused&&!p.ended?"playing":"default",{captions:d.getAttribute("data-value")??""}),f.matches(":popover-open")&&f.hidePopover()};f.addEventListener("click",d=>g(d.target.closest('[role="menuitemradio"]'))),f.addEventListener("dropdown:select",d=>g(d.detail?.item)),U(l,"data-dropdown-trigger",u),e.contains(l)?o(e).append(f):o(l).after(f)}U(l,"popovertarget",f.id),l.hasAttribute("data-init")&&(U(l,"aria-haspopup","menu"),U(l,"aria-controls",f.id)),f._mediaItems!==c&&(f._mediaItems=c,o(f).html(c));for(let u of o(f).find('[role="menuitemradio"]').toArray())U(u,"aria-checked",u.getAttribute("data-value")===a?"true":"false");for(let u of o(f).find(`[data-${t}-menu-current]`).toArray()){let g=u.closest(".dropdown-sub"),d=g?o(g).find('[role="menuitemradio"][aria-checked="true"]').get(0):void 0,p=d?o(d).text():"";o(u).text()!==p&&o(u).text(p)}}}function dt(e,t){let r=N(),{playing:o,config:a}=da(e),n=At(e,t);Ar(e,t,o?"playing":"default",a,n);let i=Pe(a.duration);for(let s of n){let c=s.getAttribute(`data-${t}-action`),l=s.getAttribute(`data-${t}-output`);if(c==="seek"&&s instanceof HTMLInputElement){if(a.duration>0&&U(s,"max",String(a.duration)),U(s,"aria-valuetext",`${Pe(a.time,a.duration)} of ${i}`),!s._mediaDragging&&Math.abs(I(s.value,0)-a.time)>.05){let f=s.api;f?.setState?f.setState("default",{value:a.time}):s.value=String(a.time)}}else c==="fullscreen"&&U(s,"aria-pressed",document.fullscreenElement===e?"true":"false");if(l){let f=l==="duration"?i:l==="remaining"?`-${Pe(a.duration-a.time,a.duration)}`:Pe(a.time,a.duration);r(s).text()!==f&&r(s).text(f)}}bt(e,t)}function As(e,t,r,o,a){let n=ne(e);if("captions"in a){let i=a.captions;e._mediaCaptions=!(i===!1||i===""||i===null),e._mediaWanted=typeof i=="string"&&i!==""?i:void 0,Ee(e,t)}if(n){let i=I(a.rate,0);if(i>0&&n.playbackRate!==i&&(n.playbackRate=i),"volume"in a){let s=Math.min(1,Math.max(0,I(a.volume,n.volume)));n.volume!==s&&(n.volume=s)}if("muted"in a&&n.muted!==!!a.muted&&(n.muted=!!a.muted),"time"in a){let s=Number.isFinite(n.duration)?n.duration:1/0,c=Math.min(s,Math.max(0,I(a.time,n.currentTime)));Math.abs(n.currentTime-c)>.001&&(n.currentTime=c)}}if(Ar(e,t,r,o,At(e,t)),!!n){if(r==="playing"&&n.paused)return n.play().then(()=>{},()=>{});r!=="playing"&&!n.paused&&n.pause()}}function Es(e,t,r,o=!1){let a=ne(e);if(!a)return[];let n=wr(a,r,e,o);return Ee(e,t),n}function Ts(e,t,r,o){let a=e.api,n=ne(e);if(!a||!n)return;let i=n.paused||n.ended?"default":"playing",s=r.getAttribute(`data-${t}-action`),c=r.value;if(o.type==="click"){if(r instanceof HTMLInputElement||r instanceof HTMLSelectElement)return;s==="toggle"?a.setState(i==="playing"?"default":"playing"):s==="play"?a.setState("playing"):s==="pause"?a.setState("default"):s==="skip"?a.setState(i,{time:n.currentTime+I(r.getAttribute("data-value"),0)}):s==="mute"?a.setState(i,{muted:!n.muted}):s==="captions"?(Ee(e,t),r.hasAttribute("popovertarget")||a.setState(i,{captions:e._mediaCaptions===!1||!e._mediaTrack?!0:""})):s==="rate"&&r.hasAttribute("data-value")?a.setState(i,{rate:I(r.getAttribute("data-value"),1)}):s==="fullscreen"&&(document.fullscreenElement===e?document.exitFullscreen?.().catch(()=>{}):e.requestFullscreen?.().catch(()=>{}));return}if(s==="seek"&&r instanceof HTMLInputElement)a.setState(i,{time:I(c,0)});else if(s==="volume"&&r instanceof HTMLInputElement){let l=I(c,1);a.setState(i,l>0&&n.muted?{volume:l,muted:!1}:{volume:l})}else s==="rate"&&r instanceof HTMLSelectElement&&a.setState(i,{rate:I(c,1)})}function Ss(e){let t=`__${e}MediaInit`;if(document[t])return;document[t]=!0;let r=o=>{let a=o.target?.closest?.(`[data-${e}-action]`),n=a&&xs(a,e);a&&n&&Ts(n,e,a,o)};document.addEventListener("click",r),document.addEventListener("input",r),document.addEventListener("change",o=>{o.target instanceof HTMLInputElement&&(o.target._mediaDragging=!1)}),document.addEventListener("pointerdown",o=>{let a=o.target?.closest?.(`input[data-${e}-action="seek"]`);a&&(a._mediaDragging=!0)}),document.addEventListener("pointerup",()=>{for(let o of N()(`input[data-${e}-action="seek"]`).toArray())o._mediaDragging=!1})}function Ms(e,t,r){let o=N(),a=ne(e),n=o(e).find(`[data-${t}-action]`).toArray(),i=n.find(c=>c.getAttribute(`data-${t}-action`)==="captions");e._mediaCaptions=i?i.getAttribute("aria-pressed")!=="false":!0;let s=o(e).find(`script.${t}-tracks`).get(0);if(a&&s){let c=null;try{c=JSON.parse(o(s).text()||"null")}catch{c=null}c&&typeof c=="object"&&(c.labels&&typeof c.labels=="object"&&(e._mediaLabels={...c.labels}),wr(a,c.tracks??[],e))}for(let c of At(e,t))c.getAttribute(`data-${t}-action`)==="fullscreen"&&!document.fullscreenEnabled&&U(c,"hidden","");if(a){let c=n.find(u=>u.getAttribute(`data-${t}-action`)==="volume");c&&(a.volume=Math.min(1,Math.max(0,I(c.getAttribute("value"),1))));let l=n.find(u=>u instanceof HTMLSelectElement&&u.getAttribute(`data-${t}-action`)==="rate");l&&I(l.value,0)>0&&(a.playbackRate=I(l.value,1));let f=()=>{dt(e,t),r()};for(let u of["play","pause","ended","timeupdate","seeking","seeked","volumechange","ratechange","loadedmetadata","durationchange","emptied"])a.addEventListener(u,f);a.textTracks.addEventListener("addtrack",()=>Ee(e,t)),o(a).find("track").on("load",()=>bt(e,t)),a.textTracks.addEventListener("change",()=>Ee(e,t)),Ee(e,t),a instanceof HTMLVideoElement&&a.addEventListener("click",()=>{a.controls||!e.api||e.api.setState(a.paused||a.ended?"playing":"default")})}e.addEventListener("fullscreenchange",()=>dt(e,t)),Ss(t),dt(e,t)}var Os="en";function So(e){let t=e?.trim();if(!t)return null;try{return Intl.getCanonicalLocales(t)[0]??null}catch{return null}}function pa(e){return So(e?.closest?.("[lang]")?.getAttribute("lang"))??So(typeof document<"u"?document.documentElement?.getAttribute("lang"):null)??Os}var pt=new Map,ot=!1,ma=e=>e instanceof HTMLElement&&(e.isContentEditable||e.closest('input, textarea, select, [contenteditable="true"]')!==null),ha=e=>ma(e.target);function Mo(e){let t=ma(e.target);for(let[r,o]of pt)if(!(t&&!o.editable)&&r(e)===!0)break}function ga(e,t={}){return pt.set(e,{...t}),!ot&&typeof document<"u"&&(ot=!0,document.addEventListener("keydown",Mo)),()=>{pt.delete(e),pt.size===0&&ot&&(ot=!1,document.removeEventListener("keydown",Mo))}}var nr=["up","down","left","right","zoom","zoom-out","pop","spin","flip","skew","blur","wipe","wipe-up","iris","fade"],Fe=new WeakMap,Cs=(e,t)=>e.getAnimations({subtree:!1}).filter(r=>typeof r.animationName=="string"&&r.animationName.startsWith(t));function va(e,t,r,o,a={}){let n=e.style;r!==void 0&&e.setAttribute(t,r);let i=Cs(e,o);for(let c of i)c.cancel();n.setProperty("--df-motion-base-opacity",getComputedStyle(e).opacity),a.duration!==void 0&&n.setProperty("--df-motion-duration",`${a.duration}ms`),a.delay!==void 0&&n.setProperty("--df-motion-delay",`${a.delay}ms`),a.easing!==void 0&&n.setProperty("--df-motion-ease",a.easing),a.distance!==void 0&&n.setProperty("--df-motion-distance",a.distance);for(let c of i)c.play();return Fe.set(e,i),{finished:Promise.all(i.map(c=>c.finished.catch(()=>{}))).then(()=>{Fe.get(e)===i&&Fe.delete(e)}),cancel(){Fe.get(e)===i&&(i.forEach(c=>c.cancel()),Fe.delete(e),e.removeAttribute(t))}}}function ba(e,t,r={}){let o=e.getAttribute("data-df-entrance")??void 0,a=t??o;if(a!==void 0&&!nr.includes(a))throw new Error(`motion: unknown entrance "${a}" (supported: ${nr.join(", ")})`);return va(e,"data-df-entrance",a,"df-enter-",r)}function ya(e,t={}){return va(e,"data-df-draw",void 0,"df-draw",t)}function xa(e,t){let r=nr.includes(String(e))?String(e):"up",o=t===void 0?-1:Math.max(0,Number(t)||0),a={"data-df-entrance":r};return o>0&&(a.style=`--df-motion-delay:${o}ms`),a}function be(e,t){let r=typeof e=="number"?e:parseInt(String(e),10);return Number.isFinite(r)?Math.trunc(r):t}function Er(e,t){return t<=0?0:Math.min(t-1,Math.max(0,be(e,0)))}var at="_presentationCount";function _a(e,t={}){let r=(m,h)=>{let y=typeof m=="number"?m:Number(m);return Number.isFinite(y)?y:h},o=t.to??r(e.dataset.count,0),a=t.from??r(e.dataset.countFrom,0),n=Math.max(0,t.duration??r(e.dataset.countDuration,1200)),i=Math.max(0,t.delay??r(e.dataset.countDelay,0)),s=t.decimals??r(e.dataset.countDecimals,String(o).split(".")[1]?.length??0),c=t.format??(m=>new Intl.NumberFormat(pa(e),{minimumFractionDigits:s,maximumFractionDigits:s}).format(m)),l=e[at];typeof l=="function"&&l();let f=0,u=0,g=()=>{e.textContent=c(o)},d=typeof matchMedia=="function"&&matchMedia("(prefers-reduced-motion: reduce)").matches,p=()=>{if(d||n===0||a===o){g();return}let m=-1,h=y=>{m<0&&(m=y);let v=Math.min(1,Math.max(0,(y-m)/n)),_=1-(1-v)**3;e.textContent=v>=1?c(o):c(a+(o-a)*_),v<1&&(f=requestAnimationFrame(h))};e.textContent=c(a),f=requestAnimationFrame(h)},x=()=>{cancelAnimationFrame(f),clearTimeout(u),e[at]===x&&delete e[at]};return e[at]=x,i>0?u=setTimeout(p,i):p(),x}var Oo="ddf$: presentation element is not initialized - load dist/components/presentation/presentation.js (or all.js) first";function wa(e){let t=e?.closest(".presentation")??(typeof document<"u"?N()(".presentation").get(0)??null:null);if(!t)throw new Error("ddf$: no .presentation element found");let r=()=>N()(t).find(":scope > [data-slide]").toArray(),o=a=>{let n=t.api;if(!n)throw new Error(Oo);return n.setState("default",{index:a}),be(t.dataset.currentSlide,a)};return{el:t,slides:r,count:()=>r().length,index:()=>be(t.dataset.currentSlide,0),goTo:a=>o(Er(a,r().length)),next:()=>o(Math.min(r().length-1,be(t.dataset.currentSlide,0)+1)),prev:()=>o(Math.max(0,be(t.dataset.currentSlide,0)-1)),first:()=>o(0),last:()=>o(r().length-1),fullscreen:()=>t.hasAttribute("data-fullscreen"),toggleFullscreen:a=>{let n=t.api;if(!n)throw new Error(Oo);let i=a??!t.hasAttribute("data-fullscreen");return n.setState("fullscreen",{value:i}),i}}}function Ns(e){if(Reflect.get(globalThis,"ddf$")!==void 0)throw new Error("defuss-shadcn: globalThis.ddf$ is already defined - core installs the shared library exactly once");return Reflect.set(globalThis,"ddf$",e),e}var yt=["fadeIn","fadeOut","slideIn","slideOut","zoomIn","zoomOut","popIn","popOut","spinIn","spinOut","flipIn","flipOut","skewIn","skewOut","blurIn","blurOut","wipeIn","wipeOut","irisIn","irisOut","blocksIn","blocksOut"],$s=1500,Ls="cubic-bezier(0.16, 1, 0.3, 1)",zs="24px",Co="12px",No="12deg",$o="0.5turn",Lo=.8,Rs="50% 50%",Ds=5,Is=90,Fs=["north","south","east","west"];function ka(e,t){return Fs.includes(e)?e:t}function zo(e,t){switch(e){case"north":return`translate(0px, calc(-1 * ${t}))`;case"south":return`translate(0px, ${t})`;case"west":return`translate(calc(-1 * ${t}), 0px)`;case"east":return`translate(${t}, 0px)`}}function Ro(e){switch(e){case"north":return"inset(0px 0px 100% 0px)";case"south":return"inset(100% 0px 0px 0px)";case"west":return"inset(0px 100% 0px 0px)";case"east":return"inset(0px 0px 0px 100%)"}}function js(e,t={},r={baseOpacity:1}){let o=ka(t.direction,"north"),a=t.distance??zs,n=t.origin??Rs,i=r.baseOpacity;switch(e){case"fadeIn":return[{opacity:0},{opacity:i}];case"fadeOut":return[{opacity:i},{opacity:0}];case"slideIn":return[{transform:zo(o,a),opacity:0},{transform:"translate(0px, 0px)",opacity:i}];case"slideOut":return[{transform:"translate(0px, 0px)",opacity:i},{transform:zo(o,a),opacity:0}];case"zoomIn":return[{transform:`scale(${t.scale??Lo})`,opacity:0,transformOrigin:n},{transform:"scale(1)",opacity:i,transformOrigin:n}];case"zoomOut":return[{transform:"scale(1)",opacity:i,transformOrigin:n},{transform:`scale(${t.scale??Lo})`,opacity:0,transformOrigin:n}];case"popIn":return[{transform:"scale(0.65)",opacity:0,offset:0},{transform:"scale(1.07)",opacity:i,offset:.65},{transform:"scale(1)",opacity:i,offset:1}];case"popOut":return[{transform:"scale(1)",opacity:i,offset:0},{transform:"scale(1.07)",opacity:i,offset:.35},{transform:"scale(0.65)",opacity:0,offset:1}];case"spinIn":return[{transform:`rotate(-${$o})`,opacity:0},{transform:"rotate(0deg)",opacity:i}];case"spinOut":return[{transform:"rotate(0deg)",opacity:i},{transform:`rotate(${$o})`,opacity:0}];case"flipIn":{let s=o==="north"||o==="south"?"rotateX":"rotateY";return[{transform:`perspective(900px) ${s}(${(o==="north"||o==="west"?1:-1)*70}deg)`,opacity:0},{transform:`perspective(900px) ${s}(0deg)`,opacity:i}]}case"flipOut":{let s=o==="north"||o==="south"?"rotateX":"rotateY",c=o==="north"||o==="west"?-1:1;return[{transform:`perspective(900px) ${s}(0deg)`,opacity:i},{transform:`perspective(900px) ${s}(${c*70}deg)`,opacity:0}]}case"skewIn":{let c=o==="east"||o==="west"?"skewX":"skewY";return[{transform:`${c}(calc(${o==="west"||o==="south"?1:-1} * ${No}))`,opacity:0},{transform:`${c}(0deg)`,opacity:i}]}case"skewOut":{let c=o==="east"||o==="west"?"skewX":"skewY",l=o==="west"||o==="south"?-1:1;return[{transform:`${c}(0deg)`,opacity:i},{transform:`${c}(calc(${l} * ${No}))`,opacity:0}]}case"blurIn":return[{filter:`blur(${Co})`,opacity:0},{filter:"blur(0px)",opacity:i}];case"blurOut":return[{filter:"blur(0px)",opacity:i},{filter:`blur(${Co})`,opacity:0}];case"wipeIn":return[{clipPath:Ro(o)},{clipPath:"inset(0px 0px 0px 0px)"}];case"wipeOut":return[{clipPath:"inset(0px 0px 0px 0px)"},{clipPath:Ro(o)}];case"irisIn":return[{clipPath:`circle(0% at ${n})`},{clipPath:`circle(150% at ${n})`}];case"irisOut":return[{clipPath:`circle(150% at ${n})`},{clipPath:`circle(0% at ${n})`}];default:throw new Error(`anim: "${e}" is composite - it has no element keyframes`)}}var Ve=new WeakMap,Ae=(e,t)=>Ve.get(e)?.get(t),Do=()=>typeof globalThis.matchMedia=="function"&&globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches;function qs(e,t){let r=Ve.get(e);r&&(r.delete(t),r.size===0&&Ve.delete(e))}function Ps(e,t,r){let o=Ve.get(e);o||(o=new Map,Ve.set(e,o)),o.set(t,r)}function Aa(e){if(e.length===0)return"idle";let t=e.map(r=>r.playState);return t.every(r=>r==="finished")?"finished":t.every(r=>r==="paused")?"paused":t.some(r=>r==="running"||r==="pending")?"running":"idle"}function Us(e,t,r){let o=t.axis??"y",a=t.target??"viewport",[n,i]=t.range??[0,1];if(!t.forceFallback&&typeof globalThis.ScrollTimeline=="function"){let d=a==="viewport"?document.scrollingElement??document.documentElement:a,p=globalThis.ScrollTimeline,x=new p({source:d,axis:o==="x"?"inline":"block"});for(let m of e)m.pause(),m.timeline=x,m.play();return()=>{for(let m of e)m.timeline=document.timeline}}for(let d of e)d.pause();let c=()=>{let d;if(a==="viewport"){let p=document.documentElement;d=o==="y"?p.scrollTop/Math.max(1,p.scrollHeight-p.clientHeight):p.scrollLeft/Math.max(1,p.scrollWidth-p.clientWidth)}else d=o==="y"?a.scrollTop/Math.max(1,a.scrollHeight-a.clientHeight):a.scrollLeft/Math.max(1,a.scrollWidth-a.clientWidth);return n+Math.min(1,Math.max(0,d))*(i-n)},l=()=>{let d=c()*r;for(let p of e)p.currentTime=d},f=!1,u=()=>{f||(f=!0,requestAnimationFrame(()=>{f=!1,l()}))},g=a==="viewport"?globalThis:a;return g.addEventListener("scroll",u,{passive:!0}),l(),()=>g.removeEventListener("scroll",u)}function Ea(e,t){return{duration:t??(Do()?1:e.duration??$s),delay:Do()?0:e.delay??0,easing:e.easing??Ls,fill:"both"}}function Bs(e,t,r){let o=e,a=ka(r.direction,"north"),n=Math.max(1,Math.round(r.blocks??Ds)),i=Math.max(0,r.stagger??Is),s=Ea(r),c=s.duration,l=a==="east"||a==="west",f=o.style.position;getComputedStyle(o).position==="static"&&(o.style.position="relative");let u=document.createElement("div");u.setAttribute("data-df-anim-blocks",""),u.setAttribute("aria-hidden","true"),Object.assign(u.style,{position:"absolute",inset:"0",display:"flex",flexDirection:l?"row":"column",pointerEvents:"none",zIndex:"1",overflow:"hidden"});let g=[];for(let p=0;p<n;p++){let x=document.createElement("div");Object.assign(x.style,{flex:"1 1 0%",background:r.color??"currentColor",outline:`1px solid ${r.color??"currentColor"}`,transformOrigin:l?a==="west"?"left":"right":a==="north"?"top":"bottom"}),u.append(x);let m=l?"scaleX":"scaleY",h=t==="blocksIn"?p:n-1-p,y=t==="blocksIn"?[{transform:`${m}(0)`},{transform:`${m}(1)`}]:[{transform:`${m}(1)`},{transform:`${m}(0)`}];g.push(x.animate(y,{...s,delay:s.delay+h*i}))}o.append(u);let d=()=>{u.remove(),o.style.position=f};return t==="blocksOut"&&Promise.all(g.map(p=>p.finished.catch(()=>{}))).then(()=>{Ae(e,t)?.cleanup&&d()}),{animations:g,cleanup:d,totalMs:s.delay+(n-1)*i+c}}function Ws(e,t,r={}){if(!yt.includes(e))throw new Error(`anim: unknown animation "${e}" (supported: ${yt.join(", ")})`);ir(e,t);let o=e==="blocksIn"||e==="blocksOut",a=Ea(r),n,i=null,s;if(o){let f=Bs(t,e,r);n=f.animations,i=f.cleanup,s=f.totalMs}else{let f={baseOpacity:Number(getComputedStyle(t).opacity)||1};n=[t.animate(js(e,r,f),a)],s=a.delay+a.duration}let c=null;r.scroll&&(c=Us(n,r.scroll,s));let l={animations:n,unbind:c,cleanup:i,finished:Promise.all(n.map(f=>f.finished.catch(()=>{}))).then(()=>{})};return Ps(t,e,l),{finished:l.finished,pause:()=>n.forEach(f=>f.pause()),resume:()=>n.forEach(f=>f.play()),finish:()=>n.forEach(f=>f.finish()),reset:()=>ir(e,t),state:()=>Aa(n)}}function ir(e,t){let r=Ae(t,e);if(r){for(let o of r.animations)o.cancel();r.unbind?.(),r.cleanup?.(),qs(t,e)}}function Vs(e){return{play:(t,r)=>Ws(e,t,r),pause:t=>Ae(t,e)?.animations.forEach(r=>r.pause()),resume:t=>Ae(t,e)?.animations.forEach(r=>r.play()),finish:t=>Ae(t,e)?.animations.forEach(r=>r.finish()),reset:t=>ir(e,t),state:t=>{let r=Ae(t,e);return r?Aa(r.animations):"idle"}}}var Et=Object.freeze(Object.assign(Object.fromEntries(yt.map(e=>[e,Vs(e)])),{names:yt})),Hs=["data-init","data-api","data-state-name"],sr=new WeakMap,Io=null;function Fo(e){Io??=document.implementation.createHTMLDocument("");let t=Io.importNode(e,!0),r=document.createTreeWalker(e,NodeFilter.SHOW_ELEMENT),o=document.createTreeWalker(t,NodeFilter.SHOW_ELEMENT);for(let a=r.currentNode,n=o.currentNode;a&&n;a=r.nextNode(),n=o.nextNode())sr.has(a)||sr.set(a,n)}function Ta(e,t=[]){let r=new Set([...Hs,...t]),o=sr.get(e)??e;return{tag:o.localName,attrs:Array.from(o.attributes).filter(a=>!r.has(a.name)).map(a=>[a.name,a.value]),html:N()(o).html()??""}}function Sa(e,t){if(!t.includes("<template"))return;let r=N(),o=r(new DOMParser().parseFromString(t,"text/html").body).find("template").toArray();r(e).find("template").toArray().forEach((a,n)=>{o[n]&&a.content.replaceChildren(document.importNode(o[n].content,!0))})}function Ma(e,t){let r=N(),o=r(`<${e.tag}></${e.tag}>`);for(let[i,s]of e.attrs)o.attr(i,s);o.html(e.html);let a=r("<div></div>").append(o),n=o.get(0);return n&&Sa(n,e.html),n&&t&&t(n),a.html()??""}var Oa=Symbol.for("defuss-store.internal.v1");function Gs(e,t){Object.defineProperty(e,Oa,{value:t})}function Xs(e){let t=e[Oa];if(!t)throw new TypeError("Expected a defuss-store v1 protocol store");return t}function cr(e){try{console.error(e)}catch{}}function Ca(e){return typeof e=="object"&&e!==null&&(Array.isArray(e)||Object.getPrototypeOf(e)===Object.prototype||Object.getPrototypeOf(e)===null)}var Na=(e,t)=>Object.hasOwn(e,t);function $a(e){if(typeof e!="string"||!e)throw new TypeError("A nonempty path is required");let t=()=>new TypeError(`Invalid path: ${e}`),r=[];for(let o=0;o<e.length;){let a=e[o]==="[",n=a?++o:o,i=0,s=!0;for(let c;o<e.length&&(c=e.charCodeAt(o))!==46&&c!==91&&c!==93;o++)s&&=c>47&&c<58&&(o===n||i>0),i=i*10+c-48;if(o===n||a&&(!s||e[o++]!=="]"))throw t();if(s){if(i>4294967294)throw new RangeError("Array index out of range");r.push(i)}else{let c=e.slice(n,o);if(c==="__proto__"||c==="prototype"||c==="constructor")throw new TypeError(`Unsafe path segment: ${c}`);r.push(c)}if(e[o]==="."){if(++o===e.length||e[o]==="[")throw t()}else if(o<e.length&&e[o]!=="[")throw t()}return r}function Ks(e,t){for(let r of $a(t)){if(Object(e)!==e||!Na(e,r))return;e=e[r]}return e}function jo(e,t,r){let o=$a(t),a=r===void 0;function n(i,s){let c=o[s];if(!Ca(i)){if(i!=null)throw new TypeError("Path updates require plain objects or arrays");if(a)return i;i=typeof c=="number"?[]:{}}let l=i,f=Array.isArray(l);if(f&&typeof c!="number")throw new TypeError("Array paths require nonnegative indices");let u=Na(l,c);if(!u&&a)return i;let g=u?l[c]:void 0,d=s===o.length-1,p=d?r:n(g,s+1);if(Object.is(g,p)&&(!a||!d))return i;let x=f?l.slice():{...l,[c]:p};return d&&a?f?x.splice(c,1):delete x[c]:f&&(u?x[c]=p:Object.defineProperty(x,c,{value:p,enumerable:!0,configurable:!0,writable:!0})),x}return n(e,0)}function Ge(e,t={}){let r=t.equals??Object.is,o=e,a=!1,n=0,i=!1,s=new Set,c,l=new Set,f=[];function u(){if(a)throw new Error("Store is destroyed")}function g(m){u();let h={listener:m,active:!0};return s.add(h),c=void 0,()=>{h.active=!1,s.delete(h)&&(c=void 0)}}function d(m,h,y){if(u(),r(o,m))return;let v=o;if(o=m,++n,!s.size||(f.push({value:o,previous:v,path:h,origin:y,revision:n,listeners:c??=[...s]}),i))return;i=!0;let _=[];try{for(let w=0;w<f.length;w++){let E=f[w];for(let M of E.listeners)if(M.active)try{M.listener(E)}catch(D){_.push(D)}}}finally{f.length=0,i=!1}if(_.length)throw new AggregateError(_,"Store listeners failed after state committed")}function p(m,h,y={}){u(),typeof h!="function"&&(y=h??{},h=m,m=void 0);let v=h,_=y.equals??Object.is,w=m?.(o),E=g(M=>{let D=M.value,$=M.previous;if(m){if(D=m(M.value),_(w,D))return;$=w,w=D}v(D,$,M.path)});try{y.immediate&&v(m?w:o,void 0,void 0)}catch(M){throw E(),M}return E}let x={get value(){return o},get destroyed(){return a},get:m=>m?Ks(o,m):o,getRaw:()=>o,set(m,h){if(u(),arguments.length===1)d(m);else if(arguments.length===2&&typeof m=="string")d(jo(o,m,h),m);else throw new TypeError("set expects a value or a string path and value")},setRaw:m=>d(m),update(m){u(),d(m(o))},remove(m){u(),d(jo(o,m,void 0),m)},reset(m){d(arguments.length?m:e)},subscribe:p,onDestroy(m){return u(),l.add(m),()=>{l.delete(m)}},destroy(){if(a)return;a=!0;for(let h of s)h.active=!1;s.clear(),c=void 0;let m=[];for(let h of l){l.delete(h);try{h()}catch(y){m.push(y)}}if(m.length)throw new AggregateError(m,"Store cleanup failed")}};return Gs(x,{set:(m,h)=>d(m,void 0,h),observe:g,revision:()=>n}),x}function La(e,t,r){let o=Array.isArray(e)?e:[e];if(o.some(s=>s.destroyed))throw new Error("Computed source is destroyed");let a=()=>t(...o.map(s=>s.value)),n=Ge(a(),r),i=[];n.onDestroy(()=>{for(let s of i.splice(0))s()});try{for(let s of new Set(o))i.push(s.subscribe(()=>n.setRaw(a()))),i.push(s.onDestroy(()=>n.destroy()))}catch(s){throw n.destroy(),s}return{get value(){return n.value},get destroyed(){return n.destroyed},get:n.get,getRaw:n.getRaw,subscribe:n.subscribe,onDestroy:n.onDestroy,destroy:n.destroy}}var Js=(e,t)=>JSON.stringify(e)===JSON.stringify(t),oe=new WeakMap;function Tr(e,t){if(e===t)return!0;if(!e||!t||e.name!==t.name)return!1;try{return JSON.stringify(e.config)===JSON.stringify(t.config)}catch{return e.config===t.config}}function nt(e,t){let r=oe.get(e);return r||(Ra(e,t),oe.get(e))}function Sr(e,t){e.recorded.add(t),e.store.set(t)}function za(e,t,r,o,a=r.config){t.observer?.takeRecords();let n=t.spec.apply(e,r,o,a),i=t.observer?.takeRecords().some(s=>s.attributeName==="data-state-name")&&e.dataset.stateName;if(Sr(t,i&&t.spec.states.includes(i)?{name:i,config:r.config}:{...r}),n&&typeof n.then=="function"){let s=Promise.resolve(n).then(()=>{oe.get(e)===t&&Te(e,t)},()=>{oe.get(e)===t&&Te(e,t)});t.pending=s}return n}function Te(e,t){let r=t.store.value,o=t.spec.read?t.spec.read(e,r):{name:e.dataset.stateName||r.name,config:r.config};Tr(o,r)||Sr(t,o)}function Ys(e){let t=o=>{if(!e.states.includes(o))throw new Error(`${e.component}: unknown state "${o}" (supported: ${e.states.join(", ")})`)},r={setState(o,a,n={}){t(a);let i=nt(o,r),s=i.store.value,c={name:a,config:e.mergeConfig?{...s.config,...n}:n},l=za(o,i,c,s,n);return Te(o,i),l},getState(o){let a=nt(o,r);return Te(o,a),{...a.store.value,model:a.model}},render(o){return Ma(o.model,a=>e.markup?.(a,o))},store(o){return nt(o,r).store},commit(o,a,n){t(a);let i=nt(o,r),s={name:a,config:n??i.store.value.config};Tr(s,i.store.value)||Sr(i,s)}};return r.spec=e,r}function Qs(e){let t=oe.get(e);if(!t)return;oe.delete(e),t.observer?.disconnect(),t.unlisten?.(),t.store.destroy();let r=e;r.store===t.store&&delete r.store}function Ra(e,t,r){let o=t.spec,a=oe.get(e);if(a?.bound)return a.bound;let n=r??{name:e.dataset.stateName||"default",config:{}},i=Ge(n,{equals:Tr}),s={store:i,model:Ta(e),recorded:new WeakSet,spec:o,queued:!1};oe.set(e,s);let c=e;i.subscribe((u,g)=>{if(c.dataset.stateName!==u.name&&(c.dataset.stateName=u.name),!(!g||s.recorded.has(u))&&i.value===u){if(!o.states.includes(u.name))throw new Error(`${o.component}: unknown state "${u.name}"`);za(c,s,u,g),Te(c,s)}},{immediate:!0});let l=()=>{s.queued||(s.queued=!0,queueMicrotask(()=>{s.queued=!1,oe.get(e)===s&&!i.destroyed&&Te(c,s)}))};for(let u of o.events??[])c.addEventListener(u,l);s.unlisten=()=>{for(let u of o.events??[])c.removeEventListener(u,l)},s.observer=new MutationObserver(u=>{u.some(g=>g.attributeName!=="data-init")&&l()}),s.observer.observe(c,{attributes:!0,subtree:!0});let f={setState:(u,g)=>t.setState(e,u,g),getState:()=>t.getState(e),render:u=>t.render(u??t.getState(e)),settled:async()=>{let u;for(;s.pending&&s.pending!==u;)u=s.pending,await u}};return s.bound=f,Object.assign(e,{api:f,store:i}),f}function qo(e){let t=[];function r(o){if(o===null||typeof o=="string"||typeof o=="boolean"||typeof o=="number"&&Number.isFinite(o)&&!Object.is(o,-0))return;if(typeof o!="object")throw new TypeError("Value is not lossless JSON data");if(t.includes(o))throw new TypeError("Cyclic values cannot be persisted as JSON");if(!Ca(o))throw new TypeError("JSON persistence requires plain objects or arrays");let a=Array.isArray(o),n=Reflect.ownKeys(o);if(a&&n.length!==o.length+1)throw new TypeError("Sparse or extended arrays are not JSON data");let i=!1;t.push(o);for(let s of n){if(a&&s==="length"){i=!0;continue}let c=Object.getOwnPropertyDescriptor(o,s);if(typeof s=="symbol"||!c.enumerable||!("value"in c))throw new TypeError("JSON data cannot contain symbols, accessors or hidden properties");if(i)throw new TypeError("Extended arrays are not JSON data");r(c.value)}t.pop()}r(e)}var lr={encode(e){return qo(e),JSON.stringify(e)},decode(e){let t=JSON.parse(e);return qo(t),t}};function Zs(){let e=new Map;return{get length(){return e.size},key(t){return Number.isInteger(t)&&t>=0?[...e.keys()][t]??null:null},getItem:t=>e.get(String(t))??null,setItem:(t,r)=>{e.set(String(t),String(r))},removeItem:t=>{e.delete(String(t))},clear:()=>{e.clear()}}}function ec(e,t={}){if(e!=="local"&&e!=="session")throw new TypeError("Storage area must be local or session");let r,o;function a(){if(r)return r;try{let n=globalThis.window,i=n?.document&&n[`${e}Storage`];if(!i)throw new Error("Browser Web Storage is unavailable");o=n,r=i}catch(n){if(!t.fallback)throw n;r=t.fallback;try{t.onUnavailable?.(n)}catch(i){cr(i)}}return r}return{getItem:n=>a().getItem(n),setItem:(n,i)=>a().setItem(n,i),removeItem:n=>a().removeItem(n),subscribe(n){let i=a(),s=o;if(!s){if(!i.subscribe)throw new Error("Selected fallback does not support storage synchronization");return i.subscribe(n)}let c=l=>{l.storageArea===i&&n({key:l.key})};return s.addEventListener("storage",c),()=>s.removeEventListener("storage",c)}}}var Po="defuss-store",Zt=e=>Number.isSafeInteger(e)&&e>=0;function tc(e,t){let r=Xs(e);if(e.destroyed)throw new Error("Store is destroyed");if(r.persistence)throw new Error("Store already has an attached persistence controller");if(typeof t.key!="string"||!Zt(t.version)||typeof t.validate!="function")throw new TypeError("Persistence requires a string key, nonnegative schema version and validator");if(t.legacyVersion!==void 0&&!Zt(t.legacyVersion))throw new TypeError("Invalid legacyVersion");let o=t.hydrate??"immediate";if(!["immediate","manual","skip"].includes(o))throw new TypeError("Invalid hydration mode");if(t.sync&&!t.storage.subscribe)throw new TypeError("Storage backend does not support synchronization");let a=t.codec??lr,n={},i=o==="skip"?"active":"paused",s=!0,c=!1,l,f,u=[],g=()=>i==="destroyed";function d(){if(g())throw new Error("Persistence controller is destroyed")}function p(v,_,w=!1){if(g())return!1;l={operation:v,key:t.key,error:_},s=!0,w&&(i="paused");try{t.onError?t.onError(l):cr(l)}catch(E){cr(E)}return!1}function x(v,_){return f=v,c=v!==null,s=_,l=void 0,i="active",!0}function m(){d();let v=e.value,_=r.revision(),w="validate",E;try{if(!t.validate(v))throw new TypeError("Current state failed persistence validation");w="encode";let M={format:Po,formatVersion:1,version:t.version,value:v};if(E=a.encode(M),typeof E!="string")throw new TypeError("Codec must encode to a string");if(r.revision()!==_||g())return!1;w="write",t.storage.setItem(t.key,E)}catch(M){return p(w,M)}return g()||x(E,r.revision()!==_)}function h(v=!1){d();let _="read",w,E,M=!1;try{if(w=t.storage.getItem(t.key),g())return!1;if(w===null)return x(null,!0);if(typeof w!="string")throw new TypeError("Storage getItem must return string or null");if(c=!0,v&&w===f&&!s&&i==="active")return!0;_="decode";let $=a.decode(w);_="version";let A;if(typeof $=="object"&&$?.format===Po&&!Array.isArray($)){if($.formatVersion!==1||!Zt($.version)||!Object.hasOwn($,"value"))throw new TypeError("Unsupported or malformed persistence envelope");A=$.version,E=$.value}else if(t.legacyVersion!==void 0)M=!0,A=t.legacyVersion,E=$;else throw new TypeError("Expected a defuss-store envelope; raw data needs legacyVersion");if(A>t.version)throw new Error("Stored schema is newer than this application");if(A!==t.version){if(M=!0,_="migrate",!t.migrate)throw new Error("Schema migration is required");E=t.migrate(E,A)}if(_="validate",!t.validate(E))throw new TypeError("Stored state failed validation")}catch($){return p(_,$,!0)}if(g())return!1;let D=r.revision();x(w,M);try{r.set(E,n)}catch($){return p("notify",$)}return f===w&&r.revision()<=D+1&&!Object.is(e.value,E)&&(s=!0),!0}let y={rehydrate:()=>h(),flush:()=>m(),clear(){d();try{t.storage.removeItem(t.key)}catch(v){return p("remove",v)}return g()||x(null,!0)},status:()=>({phase:i,dirty:s,hasStoredValue:c,...l?{lastError:l}:{}}),destroy(){if(g())return;i="destroyed",r.persistence===y&&delete r.persistence;let v=[];for(let _ of u.splice(0))try{_()}catch(w){v.push(w)}if(v.length)throw new AggregateError(v,"Persistence cleanup failed")}};r.persistence=y;try{u.push(r.observe(v=>{v.origin!==n&&(s=!0,i==="active"&&v.revision===r.revision()&&m())})),u.push(e.onDestroy(()=>y.destroy())),t.sync&&u.push(t.storage.subscribe(v=>{!g()&&(o!=="manual"||f!==void 0)&&(v.key===null||v.key===t.key)&&h(!0)})),o==="immediate"&&h()}catch(v){throw y.destroy(),v}return y}var rc={},Da=new Set;function Ia(e){return rc[e]??=ec(e,{fallback:Zs(),onUnavailable:()=>Da.add(e)})}function oc(e="local"){try{Ia(e).getItem("defuss-store:probe")}catch{return!1}return!Da.has(e)}function ac(e){let t=(r,o)=>r===null?o===null:Array.isArray(r)?Array.isArray(o):typeof r=="object"?typeof o!="object"||o===null||Array.isArray(o)?!1:Object.keys(r).every(a=>a in o&&t(r[a],o[a])):typeof o==typeof r;return r=>t(e,r)}function nc(e){return{encode:t=>lr.encode(t),decode:t=>{let r;try{r=lr.decode(t)}catch{return{format:"defuss-store",formatVersion:1,version:e,value:t}}return typeof r=="object"&&r!==null&&r.format==="defuss-store"?r:{format:"defuss-store",formatVersion:1,version:e,value:r}}}}var er="defuss-store-write",ic=0,Fa=new WeakMap,Mr=e=>Fa.get(e);function sc(e){return Mr(e)?.rehydrate()??!1}function cc(e){return Mr(e)?.clear()??!1}function lc(e){let t=Mr(e)?.status();return!!t&&t.phase==="active"&&!t.lastError}function ja(e,t,r={}){let o=Ge(t,{equals:Js}),a=r.storage?null:r.area??"local",n=tc(o,{key:e,storage:r.storage??Ia(a),version:r.version??1,validate:r.validate??ac(t),sync:r.sync??!1,codec:nc(r.migrate?0:r.version??1),...r.migrate?{migrate:(s,c)=>c===0?r.migrate(s):s}:{},onError:r.onError??(()=>{})});Fa.set(o,n),o.subscribe(()=>{n.status().phase==="paused"&&n.flush()});let i=globalThis.document;if(i&&a){let s=++ic+":"+Math.random(),c=!1;o.subscribe(()=>{c||i.dispatchEvent(new CustomEvent(er,{detail:{area:a,key:e,id:s}}))});let l=f=>{let u=f.detail;if(!(!u||u.id===s||u.area!==a||u.key!==e||o.destroyed)){c=!0;try{n.rehydrate()}finally{c=!1}}};i.addEventListener(er,l),o.onDestroy(()=>i.removeEventListener(er,l))}return o}function fc(e,t,r,o={}){let a=o.area??e.dataset.persist??"session";if(a==="none")return null;let n=globalThis.location?.pathname??"",i=o.prefix??e.dataset.persistPrefix??`defuss-shadcn:${n}`,s=o.key??e.dataset.persistKey??`${i}:${t}:${e.id||r}`;return{area:a==="local"?"local":"session",key:s}}var uc=new Set(["__proto__","prototype","constructor"]);function ve(e){if(typeof e!="string"||!e)throw new TypeError("Dataview field must be a non-empty dot path.");let t=e.split(".");if(t.some(r=>!r||uc.has(r)))throw new TypeError(`Invalid or unsafe Dataview field: ${e}`);return t}function Y(e){let t=ve(e);return t.length===1?r=>typeof r=="object"&&r!==null&&Object.hasOwn(r,e)?r[e]:void 0:r=>{let o=r;for(let a of t){if(typeof o!="object"||o===null||!Object.hasOwn(o,a))return;o=o[a]}return o}}function dc(e,t,r){let o=ve(t),a=[],n=e;for(let s of o){if(n==null&&(n=/^(0|[1-9]\d*)$/.test(s)?[]:{}),typeof n!="object"||n!==e&&!Array.isArray(n)&&Object.getPrototypeOf(n)!==Object.prototype&&Object.getPrototypeOf(n)!==null)throw new TypeError("Parent paths require plain objects or arrays.");if(Array.isArray(n)&&(!/^(0|[1-9]\d*)$/.test(s)||Number(s)>4294967294))throw new TypeError("Array paths require valid nonnegative indices.");let c=n;a.push(c),n=Object.hasOwn(c,s)?c[s]:void 0}if(Object.is(n,r))return e;let i=r;for(let s=o.length-1;s>=0;s--){let c=a[s],l=Array.isArray(c)?c.slice():{...c};Object.defineProperty(l,o[s],{value:i,enumerable:!0,configurable:!0,writable:!0}),i=l}return i}function V(e){if(e===null||typeof e=="boolean"||typeof e=="string"||typeof e=="number"&&Number.isFinite(e))return JSON.stringify(e);let t=new Set;function r(o){if(o===null||typeof o=="boolean"||typeof o=="string"||typeof o=="number"&&Number.isFinite(o))return JSON.stringify(o);if(typeof o!="object"||o===null)throw new TypeError("Dataview identifiers must be finite JSON values.");if(t.has(o))throw new TypeError("Dataview identifiers cannot contain cycles.");let a=Array.isArray(o);if(!a&&Object.getPrototypeOf(o)!==Object.prototype&&Object.getPrototypeOf(o)!==null)throw new TypeError("Dataview identifiers require plain JSON objects.");let n=Reflect.ownKeys(o);if(a&&n.length!==o.length+1)throw new TypeError("Sparse or extended arrays are not JSON identifiers.");let i=new Map;for(let s of n){if(a&&s==="length")continue;let c=Object.getOwnPropertyDescriptor(o,s);if(typeof s!="string"||!c.enumerable||!("value"in c))throw new TypeError("Invalid JSON identifier property.");if(a&&(!/^(0|[1-9]\d*)$/.test(s)||Number(s)>=o.length))throw new TypeError("Invalid JSON identifier array index.");i.set(s,c.value)}t.add(o);try{return a?"["+Array.from({length:o.length},(s,c)=>r(i.get(String(c)))).join(",")+"]":"{"+[...i.keys()].sort().map(s=>JSON.stringify(s)+":"+r(i.get(s))).join(",")+"}"}finally{t.delete(o)}}return r(e)}function fr(e){let t=new Set,r=[];for(let o of e){let a=V(o);t.has(a)||(t.add(a),r.push(JSON.parse(a)))}return r}var ye=e=>e==null?void 0:V(e);function qa(e){try{return ye(e)}catch(t){if(t instanceof TypeError)return;throw t}}var re=e=>e==null||typeof e=="number"&&Number.isNaN(e)||e instanceof Date&&Number.isNaN(e.getTime()),Uo=e=>e==null?7:re(e)?6:typeof e=="boolean"?0:typeof e=="number"?1:typeof e=="bigint"?2:typeof e=="string"?3:e instanceof Date?4:5;function Ue(e,t){if(Object.is(e,t)||e===t)return 0;if(typeof e=="number"&&typeof t=="number")return Number.isNaN(e)?1:Number.isNaN(t)||e<t?-1:1;if(typeof e=="string"&&typeof t=="string")return e.localeCompare(t);if(typeof e=="boolean"&&typeof t=="boolean")return e?1:-1;let r=Uo(e),o=Uo(t);return r!==o?r-o:r>=6?0:e instanceof Date&&t instanceof Date?Math.sign(e.getTime()-t.getTime()):String(e).localeCompare(String(t))}function pc(e,t){let{op:r,value:o}=t;switch(r){case"eq":return e===o;case"neq":return e!==o;case"gt":return!re(e)&&!re(o)&&Ue(e,o)>0;case"gte":return!re(e)&&!re(o)&&Ue(e,o)>=0;case"lt":return!re(e)&&!re(o)&&Ue(e,o)<0;case"lte":return!re(e)&&!re(o)&&Ue(e,o)<=0;case"in":return Array.isArray(o)&&o.some(a=>a===e);case"contains":return typeof e=="string"&&typeof o=="string"?e.includes(o):Array.isArray(e)&&e.some(a=>a===o);case"startsWith":return typeof e=="string"&&typeof o=="string"&&e.startsWith(o);case"endsWith":return typeof e=="string"&&typeof o=="string"&&e.endsWith(o);default:return!1}}function Pa(e){let t=e.filters.map(o=>{let a=Y(o.field);if(o.op==="in"&&Array.isArray(o.value)&&o.value.length>16){let n=new Set(o.value);return i=>{let s=a(i);return!Number.isNaN(s)&&n.has(s)}}return n=>pc(a(n),o)}),r=e.sorters.map(o=>({get:Y(o.field),sign:o.direction==="desc"?-1:1}));return{matches:o=>{for(let a of t)if(!a(o))return!1;return!0},compare:(o,a)=>{for(let n of r){let i=Ue(n.get(o),n.get(a));if(i!==0)return i*n.sign}return 0}}}function mc(e,t){let r=t.tree,o=Y(r.idField),a=Y(r.parentIdField),n=e.map(A=>ye(o(A))),i=e.map(A=>a(A)),s=new Map;for(let A=0;A<e.length;A++){let S=n[A];S!==void 0&&!s.has(S)&&s.set(S,A)}let c=new Int32Array(e.length);for(let A=0;A<e.length;A++){let S=ye(i[A]),T=S===void 0?-1:s.get(S)??-1;c[A]=T===A?-1:T}let l=new Uint8Array(e.length);for(let A=0;A<e.length;A++){if(l[A]!==0)continue;let S=[],T=A;for(;T!==-1&&l[T]===0;)l[T]=1,S.push(T),T=c[T];if(T!==-1&&l[T]===1){let W=T;for(let X=c[T];X!==T;X=c[X])W=Math.min(W,X);c[W]=-1}for(let W of S)l[W]=2}let f=Array.from({length:e.length}),u=[];for(let A=0;A<e.length;A++){let S=c[A];S===-1?u.push(A):(f[S]??=[]).push(A)}let g=Pa(t);if(t.sorters.length){let A=(S,T)=>g.compare(e[S],e[T])||S-T;u.sort(A);for(let S of f)S&&S.length>1&&S.sort(A)}let d=new Uint8Array(e.length),p=0;for(let A=0;A<e.length;A++)g.matches(e[A])&&(d[A]=1,p++);let x=d.slice();if(r.includeAncestors){let A=new Uint8Array(e.length);for(let S=0;S<e.length;S++)if(d[S])for(let T=c[S];T!==-1&&!A[T];T=c[T])A[T]=1,x[T]=1}if(r.includeDescendantsOfMatch){let A=new Uint8Array(e.length),S=[];for(let T=0;T<e.length;T++)if(!(!d[T]||A[T]))for(S.push(T);S.length;){let W=S.pop();if(!A[W]){A[W]=1,x[W]=1;for(let X of f[W]??[])S.push(X)}}}let m=new Set(r.expandedIds.map(V)),h=new Set((r.collapsedIds??[]).map(V)),y=r.expandAll??r.expandedIds.length===0,v=new Set(t.meta.selectedRowIds.map(V)),_=Y(t.idField),w=t.pageSize?t.page*t.pageSize:0,E=t.pageSize?w+t.pageSize:1/0,M=[],D=0,$=[];for(let A=u.length-1;A>=0;A--)$.push({index:u[A],depth:0});for(;$.length;){let{index:A,depth:S}=$.pop(),T=f[A],W=!!T?.length,X=n[A],wo=(y?X===void 0||!h.has(X):X!==void 0&&m.has(X))&&(r.maxDepth===void 0||S<r.maxDepth);if(x[A]){if(D>=w&&D<E){let ke=v.size?qa(_(e[A])):void 0;M.push({row:e[A],meta:{depth:S,hasChildren:W,isExpanded:W&&wo,isMatch:d[A]===1,isSelected:ke!==void 0&&v.has(ke),parentId:i[A]??null}})}D++}if(wo&&T)for(let ke=T.length-1;ke>=0;ke--)$.push({index:T[ke],depth:S+1})}return{entries:M,matchedRows:p,visibleRows:D}}var hc=["eq","neq","gt","gte","lt","lte","in","contains","startsWith","endsWith"],it=(e,t)=>{if(!Array.isArray(e))throw new TypeError(`Dataview ${t} must be an array.`);return e};function gc(e={}){return{selectedRowIds:fr(Array.isArray(e.selectedRowIds)?e.selectedRowIds:[]),lockedColumns:Array.isArray(e.lockedColumns)?[...new Set(e.lockedColumns.filter(t=>typeof t=="string"&&t.length>0))]:[]}}function Ua(e={}){if(typeof e!="object"||e===null||Array.isArray(e))throw new TypeError("Dataview request must be an object.");let t=(e.filters===void 0?[]:it(e.filters,"filters")).map(s=>{if(ve(s?.field),!hc.includes(s.op))throw new TypeError(`Dataview filter op '${String(s.op)}' is not supported.`);return{field:s.field,op:s.op,value:s.value}}),r=(e.sorters===void 0?[]:it(e.sorters,"sorters")).map(s=>{ve(s?.field);let c=s.direction??s.dir??"asc";if(typeof c!="string"||!["asc","desc"].includes(c.toLowerCase()))throw new TypeError(`Dataview sorter direction '${String(c)}' is not supported.`);return{field:s.field,direction:c.toLowerCase()}}),o=e.page??0,a=e.pageSize;if(!Number.isSafeInteger(o)||o<0)throw new RangeError("Dataview page must be a safe integer >= 0.");if(a!=null&&(!Number.isSafeInteger(a)||a<=0))throw new RangeError("Dataview pageSize must be a safe integer > 0.");if(a!=null&&!Number.isSafeInteger(o*a))throw new RangeError("Dataview page offset exceeds the safe integer range.");let n;if(e.tree!==void 0){let s=e.tree;if(typeof s!="object"||s===null)throw new TypeError("Dataview tree must be an object.");if(ve(s.idField),ve(s.parentIdField),s.maxDepth!=null&&(!Number.isSafeInteger(s.maxDepth)||s.maxDepth<0))throw new RangeError("Dataview tree maxDepth must be a safe integer >= 0.");for(let c of["includeAncestors","includeDescendantsOfMatch","expandAll"])if(s[c]!==void 0&&typeof s[c]!="boolean")throw new TypeError(`Dataview tree ${c} must be boolean.`);n={idField:s.idField,parentIdField:s.parentIdField,expandedIds:fr(s.expandedIds===void 0?[]:it(s.expandedIds,"expandedIds")),expandAll:s.expandAll??s.expandedIds===void 0,collapsedIds:fr(s.collapsedIds===void 0?[]:it(s.collapsedIds,"collapsedIds")),maxDepth:s.maxDepth,includeAncestors:s.includeAncestors??!0,includeDescendantsOfMatch:s.includeDescendantsOfMatch??!1}}let i=e.idField??n?.idField??"id";return ve(i),{filters:t,sorters:r,page:o,pageSize:a,idField:i,meta:gc(e.meta),tree:n}}function vc(e,t){let r=Pa(t),o=new Set(t.meta.selectedRowIds.map(V)),a=Y(t.idField),n=t.pageSize?t.page*t.pageSize:0,i=t.pageSize?n+t.pageSize:1/0,s=[],c=0;function l(f){if(c>=n&&c<i){let u=o.size?qa(a(f)):void 0;s.push({row:f,meta:{depth:0,hasChildren:!1,isExpanded:!1,isMatch:!0,isSelected:u!==void 0&&o.has(u),parentId:null}})}c++}if(t.sorters.length||!t.filters.length){let f=t.filters.length?e.filter(r.matches):t.sorters.length?[...e]:e;t.sorters.length&&f.sort(r.compare),c=n;for(let u=n;u<Math.min(i,f.length);u++)l(f[u]);c=f.length}else for(let f of e)r.matches(f)&&l(f);return{entries:s,matchedRows:c,visibleRows:c}}function Ba(e,t){let r=t.tree?mc(e,t):vc(e,t),o=t.pageSize?Math.ceil(r.visibleRows/t.pageSize):+(r.visibleRows>0);return{...r,totalRows:e.length,page:t.page,pageSize:t.pageSize,pageCount:o,hasPreviousPage:!!t.pageSize&&t.page>0&&o>0,hasNextPage:!!t.pageSize&&t.page<o-1}}function bc(e,t,r,o="id"){if(t.length!==r.length)throw new Error("updateRows expects ids and updates arrays with equal length.");let a=Y(o);if(!t.length)return e;let n=new Map;for(let s=0;s<t.length;s++){let c=r[s];if(c===null||typeof c!="object"||Array.isArray(c))throw new TypeError("Row patches must be objects.");n.set(V(t[s]),c)}let i;for(let s=0;s<e.length;s++){let c=e[s],l=a(c);if(l===void 0)continue;let f=n.get(V(l));!f||!Reflect.ownKeys(f).filter(g=>Object.prototype.propertyIsEnumerable.call(f,g)).some(g=>!Object.hasOwn(c,g)||!Object.is(Reflect.get(c,g),Reflect.get(f,g)))||(i??=e.slice(),i[s]={...c,...f})}return i??e}function yc(e,t,r,o="after",a="id"){let n=Y(a);if(o!=="before"&&o!=="after")throw new TypeError("Row insertion position must be before or after.");if(!t.length)return e;if(!e.length||r===void 0)return[...e,...t];let i=V(r),s=e.findIndex(l=>{let f=n(l);return f!==void 0&&V(f)===i}),c=s<0?e.length:s+ +(o==="after");return[...e.slice(0,c),...t,...e.slice(c)]}function xc(e,t,r="id"){let o=Y(r);if(!t.length)return e;let a=new Set(t.map(V)),n=e.filter(i=>{let s=o(i);return s===void 0||!a.has(V(s))});return n.length===e.length?e:n}function _c(e,t,r,o="id",a="parentId"){let n=Y(o),i=Y(a),s=V(t),c=ye(r);if(!e.length)return e;let l=new Map,f=[];for(let d=0;d<e.length;d++){let p=ye(n(e[d]));p!==void 0&&!l.has(p)&&l.set(p,e[d]),p===s&&f.push(d)}if(!f.length)return e;let u=new Set;for(let d=c;d!==void 0;){if(d===s||u.has(d))throw new Error("setParent would create or attach to a parent cycle.");u.add(d);let p=l.get(d);d=p?ye(i(p)):void 0}let g;for(let d of f)ye(i(e[d]))!==c&&(g??=e.slice(),g[d]=dc(e[d],a,r));return g??e}var je=e=>(e==null?"":String(e)).toLowerCase();function wc(e){let{field:t,op:r,value:o}=e;if(r==="in"){let a=new Set((Array.isArray(o)?o:[o]).map(n=>typeof n=="string"?n.toLowerCase():n));return n=>{let i=n[t];return a.has(typeof i=="string"?i.toLowerCase():i)}}if(typeof o=="string"&&r!=="gt"&&r!=="gte"&&r!=="lt"&&r!=="lte"){let a=o.toLowerCase();switch(r){case"contains":return n=>je(n[t]).includes(a);case"startsWith":return n=>je(n[t]).startsWith(a);case"endsWith":return n=>je(n[t]).endsWith(a);case"neq":return n=>je(n[t])!==a;default:return n=>je(n[t])===a}}return a=>{let n=a[t];switch(r){case"gt":return n!=null&&n>o;case"gte":return n!=null&&n>=o;case"lt":return n!=null&&n<o;case"lte":return n!=null&&n<=o;case"neq":return n!==o;default:return n===o}}}function Wa(e,t={}){let r=t.tree?.idField??t.idField??"id",o=e,a="",n=null,i="",s=null,c=[],l=null,f="",u=null,g=p=>{let x=JSON.stringify(p);if(s&&x===i)return s;let m=p.map(wc),h=[],y=[];for(let v of o)m.every(_=>_(v))&&(h.push(v[r]),y.push(v));return i=x,s=h,c=y,h},d=(p={})=>(p.filters??[]).filter(x=>x&&x.field&&x.value!==""&&x.value!=null);return{get rows(){return o},idField:r,tree:t.tree,query(p={}){let x=JSON.stringify([p.filters??[],p.sorters??[],p.expanded??[],p.collapsed??[]]);if(n&&x===a)return n;let m=d(p),h=m.length>0,y=Ua({idField:r,sorters:p.sorters??[],filters:h?[{field:r,op:"in",value:g(m)}]:[],tree:t.tree?{...t.tree,includeAncestors:!0,...h?{expandAll:!0,collapsedIds:p.collapsed??[]}:{expandedIds:p.expanded??[]}}:void 0}),v=Ba(o,y);return n={entries:v.entries,totalRows:v.totalRows,matchedRows:v.matchedRows,visibleRows:v.visibleRows},a=x,n},setRows(p){o=p,n=null,a="",s=null,c=[],l=null,u=null,f=""},branchIds(){if(!t.tree)return[];if(l)return l;let p=new Set;for(let x of o){let m=x[t.tree.parentIdField];m!=null&&p.add(m)}return l=o.filter(x=>p.has(x[r])).map(x=>x[r]),l},aggregate(p,x){let m=d(p),h=JSON.stringify([m,x]);if(u&&h===f)return u;let y=o;return m.length&&(g(m),y=c),u={rows:Or(y,x),matchedRows:y.length,totalRows:o.length},f=h,u}}}var Va={minute:6e4,hour:36e5,day:864e5,week:6048e5};function mt(e,t){if(!t.includes("."))return Object.hasOwn(e,t)?e[t]:void 0;let r=e;for(let o of t.split(".")){if(r==null||typeof r!="object"||!Object.hasOwn(r,o))return;r=r[o]}return r}function kc(e){return typeof e=="number"?e:e instanceof Date?e.getTime():typeof e=="string"&&e?Date.parse(e):Number.NaN}function Ac(e,t){let r=Va[t];if(t==="week")return Math.floor((e-4*864e5)/r)*r+4*864e5;if(r)return Math.floor(e/r)*r;let o=new Date(e);return t==="month"?Date.UTC(o.getUTCFullYear(),o.getUTCMonth(),1):Date.UTC(o.getUTCFullYear(),0,1)}function Ec(e,t){let r=Va[t];if(r)return e+r;let o=new Date(e);return t==="month"?Date.UTC(o.getUTCFullYear(),o.getUTCMonth()+1,1):Date.UTC(o.getUTCFullYear()+1,0,1)}function Tc(e){let{field:t,bucket:r}=e;if(r===void 0)return o=>mt(o,t)??null;if(typeof r=="number"){if(!(r>0))throw new RangeError("aggregate: a numeric bucket must be a positive width");return o=>{let a=mt(o,t);return typeof a=="number"&&Number.isFinite(a)?Math.floor(a/r)*r:null}}if(!["minute","hour","day","week","month","year"].includes(r))throw new RangeError(`aggregate: unknown time bucket "${r}"`);return o=>{let a=kc(mt(o,t));return Number.isFinite(a)?Ac(a,r):null}}var Sc=(e,t)=>e===t?0:e==null?1:t==null?-1:typeof e=="number"&&typeof t=="number"?e-t:String(e).localeCompare(String(t));function Or(e,t={}){let r=(t.groupBy===void 0?[]:Array.isArray(t.groupBy)?t.groupBy:[t.groupBy]).map(m=>typeof m=="string"?{field:m}:m),o=t.measures?.length?t.measures:[{op:"count"}];for(let m of o)if(m.op!=="count"&&!m.field)throw new TypeError(`aggregate: the measure "${m.op}" needs a field`);let a=r.map(m=>m.as??m.field),n=o.map(m=>m.as??(m.op==="count"?"count":m.op+"_"+m.field)),i=r.map(Tc),s=m=>({keys:m,count:0,m:o.map(h=>h.op==="distinct"?new Set:[0,0,1/0,-1/0])}),c=(m,h)=>{m.count++;for(let y=0;y<o.length;y++){let v=o[y];if(v.op==="count")continue;let _=mt(h,v.field),w=m.m[y];if(w instanceof Set){_!=null&&w.add(_);continue}typeof _!="number"||!Number.isFinite(_)||(w[0]+=_,w[1]++,_<w[2]&&(w[2]=_),_>w[3]&&(w[3]=_))}},l=new Map,f=i.length===1?i[0]:null;for(let m of e){let h;if(f){let y=f(m);h=l.get(y),h||l.set(y,h=s([y]))}else{let y=i.map(_=>_(m)),v=i.length?JSON.stringify(y):"";h=l.get(v),h||l.set(v,h=s(y))}c(h,m)}let u=r[0];if(t.fill&&r.length===1&&u.bucket!==void 0&&l.size>1){let m=[...l.keys()].filter(h=>typeof h=="number");if(m.length){let h=Math.min(...m),y=Math.max(...m),v=w=>typeof u.bucket=="number"?w+u.bucket:Ec(w,u.bucket),_=0;for(let w=h;w<=y&&_<1e4;w=v(w),_++)l.has(w)||l.set(w,s([w]))}}let g=[...l.values()],d=(m,h)=>{let y=o[h];if(y.op==="count")return m.count;let v=m.m[h];return v instanceof Set?v.size:y.op==="sum"?v[0]:v[1]?y.op==="avg"?v[0]/v[1]:y.op==="min"?v[2]:v[3]:null},p=t.sort?.by??(t.limit!==void 0?n[0]:a[0]),x=t.sort?.direction??(t.sort||t.limit===void 0?"asc":"desc");if(p!==void 0){let m=a.indexOf(p),h=n.indexOf(p);if(m<0&&h<0)throw new RangeError(`aggregate: cannot sort by "${p}" - not a key or a measure`);let y=v=>m>=0?v.keys[m]:d(v,h);g.sort((v,_)=>(x==="desc"?-1:1)*Sc(y(v),y(_)))}if(t.limit!==void 0&&g.length>t.limit){let m=g.slice(t.limit);if(g=g.slice(0,Math.max(0,t.limit)),t.other!==void 0){let h=s(a.map((y,v)=>v===0?t.other:null));for(let y of m)h.count+=y.count,y.m.forEach((v,_)=>{let w=h.m[_];if(v instanceof Set)for(let E of v)w.add(E);else{let E=w;E[0]+=v[0],E[1]+=v[1],E[2]=Math.min(E[2],v[2]),E[3]=Math.max(E[3],v[3])}});g.push(h)}}return g.map(m=>{let h={};return a.forEach((y,v)=>h[y]=m.keys[v]),n.forEach((y,v)=>h[y]=d(m,v)),h})}function Ha(e,t,r="text"){let o=t.trim();if(!o)return null;if(r==="select")return{field:e,op:"eq",value:o};if(r==="number"){let a=/^(>=|<=|!=|>|<|=)?\s*(-?\d+(?:\.\d+)?)$/.exec(o);return a?{field:e,op:{">=":"gte","<=":"lte","!=":"neq",">":"gt","<":"lt","=":"eq"}[a[1]??"="]??"eq",value:Number(a[2])}:null}return{field:e,op:"contains",value:o}}function Mc(e){return e?({gte:">=",lte:"<=",neq:"!=",gt:">",lt:"<"}[e.op]??"")+String(e.value??""):""}function Ga(e=[],t,r=!1){let o=e.findIndex(s=>s.field===t),a=o<0?void 0:e[o].direction??e[o].dir??"asc",n=a===void 0?"asc":a==="asc"?"desc":null;if(!r)return n?[{field:t,direction:n}]:[];let i=e.map(s=>({field:s.field,direction:s.direction??s.dir??"asc"}));return o<0?[...i,{field:t,direction:"asc"}]:n?(i[o]={field:t,direction:n},i):i.filter((s,c)=>c!==o)}var Oc=15e6,Cc=4;function Cr(e,t){return Math.min(e*t,Oc)}function Xa(e,t,r,o){let a=r*o-t,n=Cr(r,o)-t;return a<=0||n<=0?0:e/n*a}function Nc(e,t,r,o,a=Cc){let n=Math.ceil(t/r)+a*2,i=Xa(e,t,o,r),s=Math.max(0,Math.floor(i/r)-a);return s+n>o&&(s=Math.max(0,o-n)),{first:s,count:Math.min(n,o),shift:s*r-(i-e)}}function ur(e,t,r,o){let a=Math.max(0,Math.min(o-1,e))*r,n=o*r-t;return n>0?a*((Cr(o,r)-t)/n):0}function $c(e,t,r,o,a){let n=ur(e,r,o,a),i=Xa(t,r,a,o),s=e*o;return s>=i&&s+o<=i+r?t:s<i?n:ur(e-Math.max(0,Math.floor(r/o)-1),r,o,a)}function Ka(e){return e.sheet?.href??e.href}var Ja="data-df-theme-link",Bo=new Map;function Lc(e){let t=N(),r=t("#tokens-css").get(0)??t('link[href*="default-semantic-tokens.css"]').get(0);return r?new URL(`../${e}.json`,Ka(r)).href:`${e}.json`}function zc(e){let t;try{t=JSON.parse(e)}catch(o){throw new Error(`theme links: invalid JSON - ${o instanceof Error?o.message:o}`)}let r=t;if(!r||r.schema!=="v1")throw new Error('theme links: $.schema must be "v1"');if(!Array.isArray(r.links))throw new Error("theme links: $.links must be an array");for(let[o,a]of r.links.entries()){if(!a||a.type!=="link")throw new Error(`theme links: $.links[${o}].type must be "link" (got ${JSON.stringify(a&&a.type)})`);if(!a.attributes||typeof a.attributes!="object")throw new Error(`theme links: $.links[${o}].attributes must be an object`)}return{schema:"v1",links:r.links}}function dr(){N()(`link[${Ja}]`).remove()}function Rc(e,t){let r=N();if(!r("#df-theme-links").get(0)){let o=document.createElement("template");o.id="df-theme-links",document.head.append(o)}dr();for(let o of t){let a=o.attributes.rel??"",n=o.attributes.href??"";if(r(`link[rel="${CSS.escape(a)}"][href="${CSS.escape(n)}"]`).get(0))continue;let s=document.createElement("link");for(let[c,l]of Object.entries(o.attributes))s.setAttribute(c,String(l));s.setAttribute(Ja,e),document.head.append(s)}}function Ya(e,t){if(!e||e==="default")return dr(),Promise.resolve();let r=Bo.get(e);return r||(r=(async()=>{try{let o=await fetch(t??Lc(e));return o.ok?zc(await o.text()):null}catch(o){if(o instanceof SyntaxError||o instanceof Error&&o.message.startsWith("theme links"))throw o;return null}})(),Bo.set(e,r)),r.then(o=>{o?Rc(e,o.links):dr()})}function Qa(){let e=N(),t=e.shadcn??={};return typeof globalThis.$!="function"&&(globalThis.$=document.querySelector.bind(document)),t}function Za(e){let t=()=>{try{e.showPopover()}catch{}},r=()=>getComputedStyle(e).display!=="none";if(!r()){t();return}let o=performance.now()+500,a=()=>{!r()||performance.now()>o?t():requestAnimationFrame(a)};requestAnimationFrame(a)}var en="0.9.14",Dc=Reflect.get(globalThis,"df$");if(Dc!==void 0)throw new Error("defuss-shadcn core: globalThis.df$ is already defined - load core OR all, never both and never twice");var Xe=ps(Wo);Reflect.set(globalThis,"df$",Xe);var tn=Xe.shadcn??={};tn.shared={abi:en,defussGlobals:Qa,safeShowPopover:Za,defussQuery:N,debounce:fa,textLocale:pa,animateCount:_a,clampIndex:Er,coerceIndex:be,presentationScope:wa,revealAttr:xa,entrance:ba,draw:ya,anim:Et,bindGlobalKeys:ga,isEditableTarget:ha,loadTheme:Ya,sheetUrl:Ka,mathClone:gs,mathText:vs,bindMedia:Ms,mediaApply:As,mediaMarkup:Ar,mediaOf:ne,mediaPaint:dt,mediaRead:da,mediaTextTracks:wr,mediaTime:Pe,mediaTracks:Es,elementModel:Ta,renderModel:Ma,settleTemplates:Sa,componentState:Ys,bindComponent:Ra,unbindComponent:Qs,createStore:Ge,computed:La,persisted:ja,reload:sc,forget:cc,persistOk:lc,viewPersistence:fc,dataSource:Wa,parseFilter:Ha,filterText:Mc,cycleSort:Ga,aggregate:Or,virtualWindow:Nc,sizerHeight:Cr,scrollTopFor:ur,scrollIntoViewTop:$c};Reflect.set(Xe,"store",{create:Ge,computed:La,persisted:ja,available:oc});Reflect.set(Xe,"dataview",{source:Wa,aggregate:Or,parseFilter:Ha,cycleSort:Ga,create:Ua,evaluate:Ba,addRows:yc,removeRows:xc,updateRows:bc,setParent:_c});Reflect.set(Xe,"anim",Et);if(typeof document<"u"){let e=()=>{document.body&&Fo(document.body),new MutationObserver(t=>{for(let r of t)for(let o of r.addedNodes)o.nodeType===Node.ELEMENT_NODE&&Fo(o)}).observe(document,{childList:!0,subtree:!0})};document.body?e():document.addEventListener("DOMContentLoaded",e,{once:!0})}tn.anim=Et;Ns({abi:en,defussGlobals:Qa,safeShowPopover:Za,defussQuery:N,debounce:fa,presentation:wa,animateCount:_a,revealAttr:xa,entrance:ba,draw:ya,anim:Et,bindGlobalKeys:ga,isEditableTarget:ha,loadTheme:Ya,clampIndex:Er,coerceIndex:be});var Nr=globalThis.df$,Lr=Nr&&Nr.shadcn&&Nr.shadcn.shared;if(!Lr||Lr.abi!=="0.9.14")throw new Error("defuss-shadcn: runtime incomplete; load core before component scripts, or load all alone");var{defussGlobals:Ic,safeShowPopover:Fc,defussQuery:jc,componentState:qc,bindComponent:Pc}=Lr,rn=Ic(),$r=jc(),on=["default","open"];function Uc(e,t,r){switch(t){case"default":try{e.hidePopover()}catch{}break;case"open":Fc(e);break}}var an=qc({component:"navigation-menu",states:on,apply:(e,t)=>Uc(e,t.name,t.config),markup:(e,t)=>(t.name,void 0)});rn.navigationMenuApi=an;rn.navigationMenuStates=on;function nn(){$r(".nav-menu-trigger[popovertarget]:not([data-init])").toArray().forEach(e=>{e.dataset.init="";let t=$r("#"+CSS.escape(e.getAttribute("popovertarget"))).get(0);if(!t)return;let r=`--nav-menu-${t.id}`;e.style.anchorName=r,t.style.positionAnchor=r}),$r(".nav-menu-content[popover]:not([data-init])").toArray().forEach(e=>{e.dataset.init="",Pc(e,an)})}nn();new MutationObserver(nn).observe(document,{childList:!0,subtree:!0});var zr=globalThis.df$,Rr=zr&&zr.shadcn&&zr.shadcn.shared;if(!Rr||Rr.abi!=="0.9.14")throw new Error("defuss-shadcn: runtime incomplete; load core before component scripts, or load all alone");var{defussGlobals:Bc,defussQuery:Wc,componentState:Vc,bindComponent:Hc}=Rr,sn=Bc(),Ke=Wc(),cn=["default","open"];function Gc(e,t){Ke(e).attr("open",t==="open"?"":null)}function Xc(e,t,r){switch(t){case"default":e.open&&e.close();break;case"open":e.open||e.showModal();break}}var ln=e=>e.open?"open":"default",fn=Vc({component:"sheet",states:cn,apply:(e,t)=>Xc(e,t.name,t.config),read:(e,t)=>({name:ln(e),config:t.config}),markup:(e,t)=>Gc(e,t.name)});sn.sheetApi=fn;sn.sheetStates=cn;function un(){Ke("[data-sheet-trigger]:not([data-init])").toArray().forEach(e=>{e.dataset.init="";let t=Ke("#"+CSS.escape(e.dataset.sheetTrigger)).get(0);t&&e.addEventListener("click",()=>{t._trigger=e,t.showModal()})}),Ke("dialog.sheet:not([data-init])").toArray().forEach(e=>{e.dataset.init="",Hc(e,fn,{name:ln(e),config:{}}),e.addEventListener("click",t=>{t.target===e&&e.close()}),Ke(e).find("[data-sheet-close]").toArray().forEach(t=>{t.addEventListener("click",()=>{e.close()})}),e.addEventListener("close",()=>{e.open||e._trigger&&e._trigger.focus()})})}un();new MutationObserver(un).observe(document,{childList:!0,subtree:!0});var Dr=globalThis.df$,Ir=Dr&&Dr.shadcn&&Dr.shadcn.shared;if(!Ir||Ir.abi!=="0.9.14")throw new Error("defuss-shadcn: runtime incomplete; load core before component scripts, or load all alone");var{defussGlobals:Kc,defussQuery:Jc,componentState:Yc,bindComponent:dn}=Ir,yn=Kc(),C=Jc(),xn=["default","active","disabled"],_n=":scope > :is(svg, img, i, .tab-icon)",Qc=/^[a-z][a-z0-9-]*$/,St=e=>{let t=C(e).find(_n).get(0);return t?t.getAttribute("data-lucide")??t.textContent.trim():""},Mt=e=>{let t=C(e).find(":scope > .tab-label").get(0);return t?t.textContent.trim():Array.from(e.childNodes).filter(r=>r.nodeType===Node.TEXT_NODE).map(r=>r.textContent).join("").trim()},wn=(e,t)=>{let r=C(e).find(":scope > .tab-label").get(0);if(r){r.textContent=t;return}Array.from(e.childNodes).forEach(o=>{o.nodeType===Node.TEXT_NODE&&o.remove()}),e.append(document.createTextNode(t))},kn=(e,t)=>{if(C(e).find(_n).get(0)?.remove(),!t)return;let r=document.createElement(Qc.test(t)?"i":"span");r.className="tab-icon",r.setAttribute("aria-hidden","true"),r.tagName==="I"?r.setAttribute("data-lucide",t):r.textContent=t,e.prepend(r),r.tagName==="I"&&globalThis.lucide?.createIcons?.()},An=(e,t)=>{typeof t.label=="string"&&t.label!==Mt(e)&&wn(e,t.label),typeof t.icon=="string"&&t.icon!==St(e)&&kn(e,t.icon)},En=e=>{let t=e.getAttribute("role")==="tablist"?e:e.closest('[role="tablist"]');return Array.from(C(t).find('[role="tab"]').toArray())},ie=(e,t)=>{t.forEach(o=>{o.setAttribute("aria-selected","false"),o.setAttribute("tabindex","-1"),o.dataset.stateName=o.disabled?"disabled":"default";let a=C("#"+CSS.escape(o.getAttribute("aria-controls"))).get(0);a&&(a.hidden=!0)}),e.setAttribute("aria-selected","true"),e.removeAttribute("tabindex"),e.dataset.stateName="active";let r=C("#"+CSS.escape(e.getAttribute("aria-controls"))).get(0);r&&(r.hidden=!1)},pn=(e,t)=>{let r=t.indexOf(e);for(let o=1;o<=t.length;o++){let a=t[(r+o)%t.length];if(!a.disabled&&a!==e)return a}return null},Fr=e=>e.disabled?"disabled":e.getAttribute("aria-selected")==="true"?"active":"default",Zc=e=>{e.disabled=e._authored.disabled,Mt(e)!==e._authored.label&&wn(e,e._authored.label),St(e)!==e._authored.icon&&kn(e,e._authored.icon),e.dataset.stateName=Fr(e)},mn=e=>e.find(t=>t._authored.selected)||e.find(t=>!t.disabled);function el(e,t,r){let o=En(e),a=e.getAttribute("role")==="tablist",n=Object.keys(r).length>0&&Tt.getState(e).name===t;if(a){if(!n)switch(t){case"default":{o.forEach(Zc);let c=mn(o);c&&ie(c,o);break}case"active":o.forEach(c=>{c.disabled&&!c._authored.disabled&&(c.disabled=!1)});break;case"disabled":o.forEach(c=>{c.disabled=!0,c.dataset.stateName="disabled"});break}let s=typeof r.index=="number"?o[r.index]:typeof r.id=="string"?o.find(c=>c.id===r.id):null;s&&!s.disabled&&ie(s,o);return}let i=e;if(!n)switch(t){case"default":{let s=i.getAttribute("aria-selected")==="true";if(i.disabled=!1,i._authored.selected)ie(i,o);else if(s){let c=mn(o.filter(l=>l!==i))||pn(i,o);c&&c!==i?ie(c,o):i.setAttribute("aria-selected","false")}i.dataset.stateName=Fr(i);break}case"active":i.disabled||ie(i,o);break;case"disabled":{let s=i.getAttribute("aria-selected")==="true";if(i.disabled=!0,i.dataset.stateName="disabled",s){let c=pn(i,o);c&&ie(c,o),i.dataset.stateName="disabled"}break}}An(i,r)}var hn=(e,t)=>{t.forEach(r=>C(r).attr("aria-selected","false").attr("tabindex","-1")),C(e).attr("aria-selected","true").attr("tabindex",null)},tl=e=>C(e).attr("aria-selected")==="true",gn=e=>C(e).attr("disabled")!=null;function rl(e,t,r){let o=C(e).find('[role="tab"]').toArray();if(t==="default"){let n=o.find(tl)||o.find(i=>!gn(i));n&&hn(n,o)}else t==="disabled"&&o.forEach(n=>C(n).attr("disabled",""));let a=typeof r?.index=="number"?o[r.index]:typeof r?.id=="string"?o.find(n=>n.id===r.id):null;a&&!gn(a)&&hn(a,o)}function ol(e,t,r){t==="active"?C(e).attr("disabled",null).attr("aria-selected","true").attr("tabindex",null):C(e).attr("disabled",t==="disabled"?"":null),An(e,r??{})}var Tt=Yc({component:"tabs",states:xn,apply:(e,t,r,o)=>el(e,t.name,o),read:(e,t)=>{if(e.getAttribute("role")==="tablist"){let r=En(e),o=r.findIndex(i=>i.getAttribute("aria-selected")==="true"),a=r.findIndex(i=>i._authored?.selected);return{name:r.every(i=>i.disabled)?"disabled":o===a||a<0&&o<=0?"default":"active",config:{...t.config,index:o,id:r[o]?.id??""}}}return{name:Fr(e),config:{...t.config,label:Mt(e),icon:St(e)}}},markup:(e,t)=>(e.getAttribute("role")==="tablist"?rl:ol)(e,t.name,t.config),mergeConfig:!0});yn.tabsApi=Tt;yn.tabsStates=xn;function al(){C('[role="tablist"]:not([data-init]):has(.tab-trigger)').toArray().forEach(e=>{e.dataset.init="";let t=Array.from(C(e).find('[role="tab"]').toArray());t.forEach(a=>{a._authored={selected:a.getAttribute("aria-selected")==="true",disabled:a.disabled,label:Mt(a),icon:St(a)},dn(a,Tt)}),dn(e,Tt);let r=e.closest(".tabs")?.getAttribute("data-side");(r==="left"||r==="right")&&!e.hasAttribute("aria-orientation")&&e.setAttribute("aria-orientation","vertical");let o=()=>{let a=e.closest(".tabs")?.getAttribute("data-side");return a==="left"||a==="right"?!0:a==="top"||a==="bottom"?!1:e.getAttribute("aria-orientation")==="vertical"};t.forEach(a=>{a.addEventListener("click",()=>{ie(a,t)}),a.addEventListener("keydown",n=>{let i=t.indexOf(a),s,c=o()?"ArrowDown":"ArrowRight",l=o()?"ArrowUp":"ArrowLeft";switch(n.key){case c:n.preventDefault();for(let f=1;f<=t.length;f++){let u=t[(i+f)%t.length];if(!u.disabled){s=u;break}}break;case l:n.preventDefault();for(let f=1;f<=t.length;f++){let u=t[(i-f+t.length)%t.length];if(!u.disabled){s=u;break}}break;case"Home":n.preventDefault(),s=t.find(f=>!f.disabled);break;case"End":n.preventDefault(),s=t.slice().reverse().find(f=>!f.disabled);break}s&&!s.disabled&&(ie(s,t),s.focus())})})})}function vn(){let e="";try{e=decodeURIComponent(location.hash.slice(1))}catch{return}if(!e||e.startsWith("/"))return;let t=C("#"+CSS.escape(e)).get(0);if(!t)return;let r=[],o=a=>a?C(a).closest('[role="tabpanel"]').get(0):void 0;for(let a=o(t);a;a=o(a.parentElement))a.hidden&&r.unshift(a);if(r.length){for(let a of r){let n=C('[role="tab"][aria-controls="'+CSS.escape(a.id)+'"]').get(0),i=n&&C(n).closest('[role="tablist"]').get(0);if(!n||n.disabled||!i)return;ie(n,C(i).find('[role="tab"]').toArray())}t.scrollIntoView()}}var bn=!1;function Tn(){let e=C('[role="tablist"][data-init]').length;al(),C('[role="tablist"][data-init]').length!==e&&vn(),bn||(bn=!0,addEventListener("hashchange",vn))}Tn();new MutationObserver(Tn).observe(document,{childList:!0,subtree:!0});var jr=globalThis.df$,qr=jr&&jr.shadcn&&jr.shadcn.shared;if(!qr||qr.abi!=="0.9.14")throw new Error("defuss-shadcn: runtime incomplete; load core before component scripts, or load all alone");var{defussGlobals:nl,defussQuery:il,componentState:sl,bindComponent:cl}=qr,Sn=nl(),de=il(),Mn=["default","pressed"];function On(e,t,r){de(e).attr("aria-pressed",t==="pressed"?"true":r)}function ll(e,t,r){On(e,t,e._defaultPressed??"false")}var Cn=sl({component:"toggle",states:Mn,apply:(e,t)=>ll(e,t.name,t.config),read:(e,t)=>({name:de(e).attr("aria-pressed")==="true"?"pressed":"default",config:t.config}),markup:(e,t)=>{let r=t.model.attrs.find(([o])=>o==="aria-pressed");On(e,t.name,r?r[1]:"false")}});Sn.toggleApi=Cn;Sn.toggleStates=Mn;function Nn(){de(".toggle:not([data-init]):not(.toggle-group .toggle)").each((e,t)=>{de(t).data("init",""),t._defaultPressed=de(t).attr("aria-pressed")||"false",cl(t,Cn,{name:t._defaultPressed==="true"?"pressed":"default",config:{}}),de(t).on("click",()=>{de(t).attr("aria-pressed",String(de(t).attr("aria-pressed")!=="true"))})})}Nn();new MutationObserver(Nn).observe(document,{childList:!0,subtree:!0});var Pr=globalThis.df$,Ur=Pr&&Pr.shadcn&&Pr.shadcn.shared;if(!Ur||Ur.abi!=="0.9.14")throw new Error("defuss-shadcn: runtime incomplete; load core before component scripts, or load all alone");var{defussGlobals:fl,defussQuery:ul,componentState:dl,bindComponent:pl}=Ur,$n=fl(),Br=ul(),Ln=["default","disabled"];function ml(e,t){Br(e).attr("data-disabled",t==="disabled"?"":null)}function hl(e,t,r){switch(t){case"default":e.removeAttribute("data-disabled");break;case"disabled":e.setAttribute("data-disabled","");break}}var zn=dl({component:"toggle-group",states:Ln,apply:(e,t)=>hl(e,t.name,t.config),read:(e,t)=>({name:e.hasAttribute("data-disabled")?"disabled":"default",config:t.config}),markup:(e,t)=>ml(e,t.name)});$n.toggleGroupApi=zn;$n.toggleGroupStates=Ln;function Rn(){Br(".toggle-group:not([data-init])").toArray().forEach(e=>{e.dataset.init="",pl(e,zn);let t=e.getAttribute("data-type")||"single",r=()=>Array.from(Br(e).find(".toggle:not(:disabled)").toArray());(()=>{let a=r();if(a.length===0)return;let i=a.find(s=>s.getAttribute("aria-pressed")==="true")||a[0];a.forEach(s=>{s.setAttribute("tabindex",s===i?"0":"-1")})})(),e.addEventListener("click",a=>{let n=a.target.closest(".toggle");if(!n||n.disabled||e.hasAttribute("data-disabled"))return;let i=r(),s=n.getAttribute("aria-pressed")==="true";t==="single"?(i.forEach(c=>c.setAttribute("aria-pressed","false")),s||n.setAttribute("aria-pressed","true")):n.setAttribute("aria-pressed",String(!s)),i.forEach(c=>c.setAttribute("tabindex",c===n?"0":"-1"))}),e.addEventListener("keydown",a=>{let n=a.target.closest(".toggle");if(!n||e.hasAttribute("data-disabled"))return;let i=r(),s=i.indexOf(n);if(s===-1)return;let c=e.getAttribute("data-orientation")==="vertical",l=c?"ArrowDown":"ArrowRight",f=c?"ArrowUp":"ArrowLeft",u;a.key===l?(a.preventDefault(),u=(s+1)%i.length):a.key===f?(a.preventDefault(),u=(s-1+i.length)%i.length):a.key==="Home"?(a.preventDefault(),u=0):a.key==="End"&&(a.preventDefault(),u=i.length-1),u!==void 0&&(i[s].setAttribute("tabindex","-1"),i[u].setAttribute("tabindex","0"),i[u].focus())})})}Rn();new MutationObserver(Rn).observe(document,{childList:!0,subtree:!0});var Wr=globalThis.df$,Hr=Wr&&Wr.shadcn&&Wr.shadcn.shared;if(!Hr||Hr.abi!=="0.9.14")throw new Error("defuss-shadcn: runtime incomplete; load core before component scripts, or load all alone");var{defussGlobals:gl,defussQuery:vl,componentState:bl,bindComponent:yl,textLocale:xl}=Hr,Fn=gl(),Se=vl(),jn=["default","indeterminate","complete"],Xr=".radial-progress",_l=()=>globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches,L=e=>parseFloat(e.getAttribute("aria-valuemax")||"")||100,Q=e=>e.hasAttribute("aria-valuenow")?parseFloat(e.getAttribute("aria-valuenow"))||0:null,qn=(e,t)=>Math.max(0,Math.min(L(e),Number(t)||0)),Pn=e=>Math.round(e*10)/10,Vr=new Map,wl=e=>{let t=xl(e);return Vr.has(t)||Vr.set(t,{pct:new Intl.NumberFormat(t,{style:"percent",maximumFractionDigits:0}),num:new Intl.NumberFormat(t,{maximumFractionDigits:1})}),Vr.get(t)};function kl(e){let{pct:t,num:r}=wl(e),o=Q(e),a=L(e);if(o==null)return e.dataset.indeterminate??"\u2026";let n=e.dataset.template;if(n)return n.replaceAll("{value}",r.format(Math.round(o))).replaceAll("{max}",r.format(a)).replaceAll("{percent}",t.format(o/a));switch(e.dataset.format){case"fraction":return`${r.format(Math.round(o))} / ${r.format(a)}`;case"value":return r.format(Math.round(o));default:return t.format(o/a)}}function Al(e){let t=Se(e).find(":scope > .radial-progress-value").get(0);return t||(e.children.length===0?e:null)}function Ye(e){let t=Q(e),r=t==null?0:t/L(e);t!=null?e.style.setProperty("--value",String(Pn(r*100))):e.style.removeProperty("--value"),e.dataset.level=r<.34?"low":r<.67?"mid":"high",e.toggleAttribute("data-complete",t!=null&&t>=L(e));let o=Al(e),a=kl(e);o&&(o.textContent=a),e.dataset.format==="fraction"||e.dataset.template?e.setAttribute("aria-valuetext",a):e._authorValuetext||e.removeAttribute("aria-valuetext")}function Me(e){e._raf&&cancelAnimationFrame(e._raf),e._raf=0,e.removeAttribute("data-running")}function Ot(e,t){e.hasAttribute("aria-valuemin")||e.setAttribute("aria-valuemin","0"),e.setAttribute("aria-valuenow",String(Pn(t))),Ye(e)}function Je(e,t){let r=e.dataset.stateName;Ot(e,t);let o=t>=L(e);e.dataset.stateName=o?"complete":"default",e.dispatchEvent(new CustomEvent("progress:change",{bubbles:!0,detail:{value:t,max:L(e),percent:t/L(e)}})),o&&r!=="complete"&&e.dispatchEvent(new CustomEvent("progress:completed",{bubbles:!0}))}function Dn(e,t,r){Me(e);let o=Q(e)??0;if(!(r>0)||_l()||o===t)return Je(e,t);let a=performance.now();e.dataset.stateName="default",e.setAttribute("data-running","");let n=i=>{let s=Math.min(1,(i-a)/r);s<1?(Ot(e,o+(t-o)*s),e._raf=requestAnimationFrame(n)):(Me(e),Je(e,t))};e._raf=requestAnimationFrame(n)}var In=e=>parseFloat(e.dataset.step||"")||L(e)/10,El=e=>parseFloat(e.dataset.duration||"")||3e3;function Tl(e,t,r){let o=Q(e);e._authorValuetext=e.hasAttribute("aria-valuetext")&&!e.dataset.format&&!e.dataset.template,e.hasAttribute("aria-valuemin")||Se(e).attr("aria-valuemin","0"),r?.max!=null&&Number(r.max)!==L(e)&&Se(e).attr("aria-valuemax",String(r.max)),t==="indeterminate"?(Se(e).attr("aria-valuenow",null),Ye(e)):Ot(e,t==="complete"?L(e):qn(e,r?.value!=null?r.value:o??0))}function Sl(e,t,r){switch(t){case"default":{r.max!=null&&Number(r.max)!==L(e)&&e.setAttribute("aria-valuemax",String(r.max));let o=qn(e,r.value!=null?r.value:e._authored??0);r.duration>0?Dn(e,o,r.duration):(Me(e),Je(e,o));break}case"indeterminate":Me(e),e.removeAttribute("aria-valuenow"),Ye(e),e.dataset.stateName="indeterminate";break;case"complete":r.duration>0?Dn(e,L(e),r.duration):(Me(e),Je(e,L(e)));break}}var pe=bl({component:"radial-progress",states:jn,apply:(e,t)=>Sl(e,t.name,t.config),read:(e,t)=>{let r=Q(e);return{name:e.dataset.stateName||"default",config:{...t.config,value:r,max:L(e),percent:r==null?null:r/L(e)}}},markup:(e,t)=>Tl(e,t.name,t.config)});Fn.radialProgressApi=pe;Fn.radialProgressStates=jn;function Gr(e,t){let r=Q(e)??0;switch(t){case"reset":pe.setState(e,"default",{value:0});break;case"increment":pe.setState(e,"default",{value:r+In(e)});break;case"decrement":pe.setState(e,"default",{value:r-In(e)});break;case"complete":pe.setState(e,"complete");break;case"indeterminate":pe.setState(e,"indeterminate");break;case"play":{r>=L(e)&&Ot(e,0);let o=1-(Q(e)??0)/L(e);pe.setState(e,"default",{value:L(e),duration:El(e)*o});break}case"pause":{let o=Q(e)??0;Me(e),Je(e,o);break}}}var Ml=["reset","increment","decrement","complete","indeterminate","play","pause"];function Un(){Se(`${Xr}:not([data-init])`).toArray().forEach(e=>{e.dataset.init="",yl(e,pe),e._authorValuetext=e.hasAttribute("aria-valuetext")&&!e.dataset.format&&!e.dataset.template,!e.hasAttribute("aria-valuenow")&&e.style.getPropertyValue("--value")!==""&&e.getAttribute("role")==="progressbar"&&e.setAttribute("aria-valuenow",String(parseFloat(e.style.getPropertyValue("--value"))/100*L(e))),e.hasAttribute("role")||e.setAttribute("role","progressbar"),e.hasAttribute("aria-valuemin")||e.setAttribute("aria-valuemin","0"),e._authored=Q(e);let t=Q(e);e.dataset.stateName=t==null?"indeterminate":t>=L(e)?"complete":"default",e.addEventListener("command",r=>{let o=String(r.command||"");o.startsWith("--")&&Gr(e,o.slice(2))});for(let r of Ml)e.addEventListener(`progress:${r}`,()=>Gr(e,r));Ye(e)})}!("commandForElement"in HTMLButtonElement.prototype)&&!document.__radialProgressCommandInit&&(document.__radialProgressCommandInit=!0,document.addEventListener("click",e=>{let t=e.target instanceof Element?e.target.closest('button[commandfor][command^="--"]'):null,r=t&&Se("#"+CSS.escape(t.getAttribute("commandfor"))).get(0);r?.matches(`${Xr}[data-init]`)&&Gr(r,t.getAttribute("command").slice(2))}));new MutationObserver(e=>{for(let t of e){let r=t.target;if(r instanceof HTMLElement&&r.matches(`${Xr}[data-init]`)&&!r._raf){Ye(r);let o=Q(r);r.dataset.stateName=o==null?"indeterminate":o>=L(r)?"complete":"default"}}}).observe(document,{attributes:!0,subtree:!0,attributeFilter:["aria-valuenow","aria-valuemax"]});Un();new MutationObserver(Un).observe(document,{childList:!0,subtree:!0});var Kr=globalThis.df$,Qr=Kr&&Kr.shadcn&&Kr.shadcn.shared;if(!Qr||Qr.abi!=="0.9.14")throw new Error("defuss-shadcn: runtime incomplete; load core before component scripts, or load all alone");var{defussGlobals:Ol,defussQuery:Cl,componentState:Nl,bindComponent:$l,textLocale:Xn}=Qr,to=Ol(),z=Cl(),Kn=["default","idle"],Bn={sharp:["C","C\u266F","D","D\u266F","E","F","F\u266F","G","G\u266F","A","A\u266F","B"],flat:["C","D\u266D","D","E\u266D","E","F","G\u266D","G","A\u266D","A","B\u266D","B"]},Zr={spring:[220,18],smooth:[220,2*Math.sqrt(220)]},Ct=.025,Ll=.35,se=100,zl=12,Rl=6,Jr=13,ee=(e,t,r)=>Math.min(r,Math.max(t,e)),G=(e,t)=>{let r=typeof e=="number"?e:e==null||e===""?NaN:Number(e);return Number.isFinite(r)?r:t},Dl=e=>e.replace(/[&<>"']/g,t=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[t]??t),F=e=>String(Math.round(e*100)/100),q=e=>e._tacho,Jn=e=>z(e).children("meter.tacho-meter").get(0)??void 0;function me(e){let t=G(e.getAttribute("min"),0),r=Math.max(t,G(e.getAttribute("max"),1)),o=ee(G(e.getAttribute("low"),t),t,r),a=ee(G(e.getAttribute("high"),r),o,r),n=ee(G(e.getAttribute("optimum"),(t+r)/2),t,r),i=ee(G(e.getAttribute("value"),0),t,r),s=e.hasAttribute("low")||e.hasAttribute("high");return{min:t,max:r,low:o,high:a,optimum:n,value:i,zoned:s}}function Yn(e){let t=e.optimum<e.low?0:e.optimum>e.high?2:1,r=o=>o===t?"optimum":Math.abs(o-t)===1?"suboptimum":"even-less-good";return[{from:e.min,to:e.low,zone:r(0)},{from:e.low,to:e.high,zone:r(1)},{from:e.high,to:e.max,zone:r(2)}]}function Il(e,t){if(!e.zoned)return null;let r=Yn(e);return(t<e.low?r[0]:t>e.high?r[2]:r[1]).zone}var Qn=e=>ee(G(e.getAttribute("data-sweep"),120),30,300),ro=(e,t)=>e.max>e.min?(ee(t,e.min,e.max)-e.min)/(e.max-e.min):.5,oo=(e,t)=>ee(G(e.getAttribute("data-rest"),t.zoned?t.optimum:(t.min+t.max)/2),t.min,t.max);function Fl(e){let t=e/10,r=10**Math.floor(Math.log10(t));return([1,2,2.5,5,10].map(o=>o*r).find(o=>o>=t)??t)||1}var Wn=e=>{let t=Math.abs(e.max-e.min);return Number.isInteger(e.min)&&Number.isInteger(e.max)&&t>=10?0:t>=1?1:2},Vn=e=>e.decimals!==null?[e.decimals,e.decimals]:e.tick?[0,3]:[Wn(e),Wn(e)],Yr=(e,[t,r],o=!1)=>new Intl.NumberFormat(e,{minimumFractionDigits:t,maximumFractionDigits:r,signDisplay:o?"exceptZero":"auto"}),Hn=(e,t)=>t.unit&&!t.tick?`${e} ${t.unit}`:e,$t={number:(e,t)=>Hn(Yr(t.locale,Vn(t)).format(e),t),signed:(e,t)=>Hn(Yr(t.locale,Vn(t),!0).format(e),t),pan:(e,t)=>{let r=Yr(t.locale,t.decimals===null?[0,t.tick?3:0]:[t.decimals,t.decimals]).format(Math.abs(e));return Number(r.replace(/\D/g,""))===0?"C":`${e<0?"L":"R"}${r}`}};function ao(e,t,r,o){let a=me(t),n=e.getAttribute("data-decimals"),i={unit:e.getAttribute("data-unit")??"",decimals:o||n===null||n===""||!Number.isFinite(Number(n))?null:Math.max(0,Math.min(6,Math.round(Number(n)))),locale:Xn(e),min:a.min,max:a.max,tick:o},s=$t[e.getAttribute("data-format")??"number"]??$t.number;try{return String(s(r,i))}catch{return $t.number(r,i)}}var xe=(e,t)=>{let r=e*Math.PI/180;return[t*Math.sin(r),-t*Math.cos(r)]};function Gn(e,t,r){if(t-e<1e-6)return"";let[o,a]=xe(e,r),[n,i]=xe(t,r);return`M${F(o)} ${F(a)}A${r} ${r} 0 ${t-e>180?1:0} 1 ${F(n)} ${F(i)}`}function jl(e,t){let r=t.max-t.min;if(r<=0)return[];let o=G(e.getAttribute("data-ticks"),Fl(r));if(o<=0||r/o>100)return[];let a=ee(Math.round(G(e.getAttribute("data-minor"),1)),0,9),n=o/(a+1),i=[],s=Math.ceil((t.min-1e-9)/n);for(let c=s;c*n<=t.max+1e-9;c++){let l=Number((c*n).toPrecision(12)),f=l/o;i.push({value:l,major:Math.abs(f-Math.round(f))<1e-6})}return i}function ql(e,t,r){let o=e.getAttribute("data-labels");if(o==="none")return!1;if(o==="ends")return Math.abs(r-t.min)<1e-9||Math.abs(r-t.max)<1e-9;let a=Number(o);if(o&&Number.isFinite(a)&&a>0){let n=r/a;return Math.abs(n-Math.round(n))<1e-6}return!0}function Zn(e,t){let r=me(t),o=Qn(e),a=p=>-o/2+ro(r,p)*o,[n,i,s,c]=[-16,-16,16,22];for(let p=-o/2;p<=o/2+1e-9;p+=o/60){let[x,m]=xe(p,se+Jr+9);n=Math.min(n,x),s=Math.max(s,x),i=Math.min(i,m),c=Math.max(c,m)}for(let p of[-90,0,90,180]){if(Math.abs(p)>o/2)continue;let[x,m]=xe(p,se+Jr+9);n=Math.min(n,x),s=Math.max(s,x),i=Math.min(i,m),c=Math.max(c,m)}let l=`${F(n)} ${F(i)} ${F(s-n)} ${F(c-i)}`,f=`<path class="tacho-track" d="${Gn(-o/2,o/2,se)}"></path>`;if(r.zoned)for(let p of Yn(r)){let x=Gn(a(p.from),a(p.to),se-3.5);x&&(f+=`<path class="tacho-zone" data-zone="${p.zone}" d="${x}"></path>`)}let u="",g="",d="";for(let p of jl(e,r)){let x=a(p.value),[m,h]=xe(x,se),[y,v]=xe(x,se-(p.major?zl:Rl)),_=`M${F(m)} ${F(h)}L${F(y)} ${F(v)}`;if(p.major?u+=_:g+=_,p.major&&ql(e,r,p.value)){let[w,E]=xe(x,se+Jr);d+=`<text class="tacho-tick-label" x="${F(w)}" y="${F(E)}">${Dl(ao(e,t,p.value,!0))}</text>`}}return f+=`<path class="tacho-tick" d="${g}"></path><path class="tacho-tick" data-major="" d="${u}"></path>${d}`,f+=`<g class="tacho-needle" transform="rotate(${F(a(oo(e,r)))})"><path class="tacho-needle-blade" d="M-2.4 0L-0.6 ${-(se-4)}L0.6 ${-(se-4)}L2.4 0L1.6 14L-1.6 14Z"></path></g>`,f+='<circle class="tacho-pivot" r="7"></circle><circle class="tacho-pivot-cap" r="2.5"></circle>',`<svg class="tacho-dial" viewBox="${l}" aria-hidden="true" focusable="false">${f}</svg>`}function eo(e){let t=q(e),r=z(Zn(e,t.meter)).get(0);z(t.dial).replaceWith(r),t.dial=r,t.needle=z(r).find(".tacho-needle").get(0),no(e),Lt(e)}function Lt(e){let t=q(e),r=Qn(e),o=`rotate(${F(-r/2+t.p*r)})`;t.needle.getAttribute("transform")!==o&&z(t.needle).attr("transform",o)}var Pl=()=>globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches??!1;function no(e){let t=q(e),r=me(t.meter);t.target=ro(r,t.status==="idle"?oo(e,r):r.value);let o=e.getAttribute("data-needle")??"spring";if(o==="instant"||!Zr[o]||Pl()){t.p=t.target,t.v=0,Lt(e),ti(t);return}t.frame||(t.last=performance.now(),t.frame=requestAnimationFrame(a=>ei(e,a)))}function ei(e,t){let r=q(e);if(r.frame=0,!e.isConnected)return;let[o,a]=Zr[e.getAttribute("data-needle")??"spring"]??Zr.spring,n=Math.min(.05,Math.max(0,(t-r.last)/1e3));for(r.last=t;n>0;){let i=Math.min(n,.004166666666666667);r.v+=(-o*(r.p-r.target)-a*r.v)*i,r.p+=r.v*i,(r.p<-Ct||r.p>1+Ct)&&(r.p=ee(r.p,-Ct,1+Ct),r.v=-r.v*Ll),n-=i}if(Math.abs(r.p-r.target)<2e-4&&Math.abs(r.v)<.002){r.p=r.target,r.v=0,Lt(e),ti(r);return}Lt(e),r.frame=requestAnimationFrame(i=>ei(e,i))}function ti(e){let t=e.waiting;e.waiting=[];for(let r of t)r()}var Oe=(e,t)=>z(e).children(t).text();function _e(e,t,r){let o=Jn(e);if(!o)return;if(r.value!==void 0&&Number.isFinite(Number(r.value))){let g=me(o),d=String(Number(ee(Number(r.value),g.min,g.max).toPrecision(12)));o.getAttribute("value")!==d&&z(o).attr("value",d)}let a=me(o),n=(g,d)=>{let p=z(e).children(g);p.length&&d!==void 0&&p.text()!==d&&p.text(d)};n(".tacho-label",r.label);let i=typeof r.text=="string"?r.text:ao(e,o,a.value,!1);n(".tacho-value",i),n(".tacho-caption",r.caption);let s=r.label??Oe(e,".tacho-label"),c=r.caption??Oe(e,".tacho-caption"),l=typeof r.text=="string"?[s,i,c].filter(Boolean).join(", "):i;o.getAttribute("aria-valuetext")!==l&&z(o).attr("aria-valuetext",l||null);let f=Il(a,a.value);e.getAttribute("data-zone")!==f&&z(e).attr("data-zone",f);let u=t==="idle"?"":null;e.getAttribute("data-idle")!==u&&z(e).attr("data-idle",u)}function ce(e){let t=q(e);return{value:me(t.meter).value,label:Oe(e,".tacho-label"),text:t.text,caption:Oe(e,".tacho-caption")}}function ri(e,t,r){let o=q(e);"text"in r&&(o.text=typeof r.text=="string"?r.text:null);let a=JSON.stringify(ce(e))+o.status;o.status=t,_e(e,t,{...ce(e),...r,text:o.text}),no(e);let n=ce(e);JSON.stringify(n)+o.status!==a&&e.dispatchEvent(new CustomEvent("tacho-change",{bubbles:!0,detail:{value:n.value,zone:e.getAttribute("data-zone"),label:n.label,text:Oe(e,".tacho-value"),caption:n.caption}}))}function Ul(e,t,r,o){q(e)?ri(e,t,o):_e(e,t,r)}var oi=Nl({component:"tacho",states:Kn,mergeConfig:!0,apply:(e,t,r,o)=>Ul(e,t.name,t.config,o),read:(e,t)=>{let r=q(e);if(!r)return t;let o=t.config,a=ce(e);return r.status===t.name&&o.value===a.value&&o.label===a.label&&o.text===a.text&&o.caption===a.caption?t:{name:r.status,config:a}},markup:(e,t)=>_e(e,t.name,t.config),events:["tacho-change"]});to.tachoApi=oi;to.tachoStates=Kn;function Bl(e){let t=/^\s*([A-Ga-g])([#♯b♭]?)(-?\d+)\s*$/.exec(e);if(!t)return null;let r={c:0,d:2,e:4,f:5,g:7,a:9,b:11}[t[1].toLowerCase()],o=t[2]==="#"||t[2]==="\u266F"?1:t[2]==="b"||t[2]==="\u266D"?-1:0;return r+o+(Number(t[3])+1)*12}function ai(e,t={}){let r=G(t.a4,440)>0?G(t.a4,440):440,o=69+12*Math.log2(e/r),a=(t.strings??[]).map(Bl).filter(s=>s!==null),n=a.length?a.reduce((s,c)=>Math.abs(c-o)<Math.abs(s-o)?c:s):Math.round(o);return{note:(t.notation==="flat"?Bn.flat:Bn.sharp)[(n%12+12)%12],octave:Math.floor(n/12)-1,cents:Math.round((o-n)*1e3)/10,target:Math.round(r*2**((n-69)/12)*100)/100}}function ni(e,t){let r=e.length,o=0;for(let h=0;h<r;h++)o+=e[h]*e[h];if(r<64||Math.sqrt(o/r)<.01)return null;let a=Math.max(2,Math.floor(t/2e3)),n=Math.min(r>>1,Math.ceil(t/50)),i=r-n-1,s=new Float32Array(n+2);for(let h=0;h<=n+1;h++){let y=0,v=0;for(let _=0;_<i;_++){let w=e[_],E=e[_+h];y+=w*E,v+=w*w+E*E}s[h]=v>0?2*y/v:0}let c=[],l=1;for(;l<=n&&s[l]>0;)l++;for(;l<=n;){for(;l<=n&&s[l]<=0;)l++;let h=-1;for(;l<=n&&s[l]>0;)(h<0||s[l]>s[h])&&(h=l),l++;h>0&&c.push(h)}if(!c.length)return null;let f=Math.max(...c.map(h=>s[h])),u=c.find(h=>h>=a&&s[h]>=.9*f);if(u===void 0)return null;let g=s[u-1],d=s[u],p=s[u+1],x=g-2*d+p,m=x?.5*(g-p)/x:0;return{frequency:t/(u+m),clarity:Math.min(1,d-.25*(g-p)*m)}}function zt(e,t,r={}){if(t===null||!Number.isFinite(Number(t))||Number(t)<=0)return q(e).status!=="idle"&&e.api?.setState("idle"),null;let o=ai(Number(t),r),a=Xn(e),n=new Intl.NumberFormat(a,{maximumFractionDigits:0,signDisplay:"exceptZero"}).format(o.cents);return e.api?.setState("default",{value:o.cents,label:o.note,text:`${new Intl.NumberFormat(a,{minimumFractionDigits:1,maximumFractionDigits:1}).format(Number(t))} Hz`,caption:`${o.note}${o.octave} \xB7 ${n} ct`}),o}function ii(e){let t=q(e),r=t.listen;if(!r||!e.isConnected)return;r.frame=0;let o=r.node.context;if(!(o instanceof AudioContext)||o.state==="running"){let a=new Float32Array(r.node.fftSize);r.node.getFloatTimeDomainData(a);let n=ni(a,o.sampleRate);n&&n.clarity>=.85?(r.quiet=0,zt(e,n.frequency,r.options)):++r.quiet>12&&t.status!=="idle"&&zt(e,null)}r.frame=requestAnimationFrame(()=>ii(e))}function si(){z(".tacho:not([data-init])").toArray().forEach(e=>{e.dataset.init="";let t=Jn(e);if(!t)return;let r=z(Zn(e,t)).get(0);z(t).before(r);let o=Oe(e,".tacho-value").trim(),a=me(t),n={meter:t,dial:r,needle:z(r).find(".tacho-needle").get(0),status:e.hasAttribute("data-idle")?"idle":"default",text:o&&o!==ao(e,t,a.value,!1)?o:null,p:ro(a,oo(e,a)),v:0,target:0,frame:0,last:0,waiting:[],listen:null};e._tacho=n,_e(e,n.status,ce(e)),no(e),$l(e,oi,{name:n.status,config:ce(e)}),new MutationObserver(i=>{let s=i.some(c=>c.attributeName!=="value"&&c.attributeName!=="aria-valuetext");s&&eo(e),i.some(c=>c.attributeName==="value")?ri(e,n.status,{}):s&&_e(e,n.status,ce(e))}).observe(t,{attributes:!0,attributeFilter:["value","min","max","low","high","optimum"]}),new MutationObserver(()=>{eo(e),_e(e,n.status,ce(e))}).observe(e,{attributes:!0,attributeFilter:["data-sweep","data-ticks","data-minor","data-labels","data-format","data-unit","data-decimals","data-rest","lang"]})})}document.__tachoInit||(document.__tachoInit=!0,document.addEventListener("input",e=>{let t=e.target.closest?.("[data-tacho-for]"),r=e.target;if(!t||!(r instanceof HTMLInputElement))return;let o=z(`#${CSS.escape(t.getAttribute("data-tacho-for")??"")}`).get(0);!o?._tacho||!Number.isFinite(r.valueAsNumber)||o.api?.setState("default",{value:r.valueAsNumber})}));var Nt=e=>{let r=(typeof e=="string"?z(e).get(0):e)?.closest?.(".tacho");return r?._tacho?r:void 0};to.tacho={value:(e,t)=>{let r=Nt(e);return r?(t!==void 0&&Number.isFinite(t)&&r.api?.setState("default",{value:t}),me(q(r).meter).value):NaN},tune:(e,t,r)=>{let o=Nt(e);return o?zt(o,t,r):null},listen:(e,t,r={})=>{let o=Nt(e);if(!o)return null;let a=q(o);if(a.listen){a.listen.frame&&cancelAnimationFrame(a.listen.frame);try{a.listen.source.disconnect(a.listen.node)}catch{}a.listen=null}if(!t)return zt(o,null),null;let n=t.context.createAnalyser();return n.fftSize=4096,t.connect(n),a.listen={node:n,source:t,frame:0,quiet:0,options:r},a.listen.frame=requestAnimationFrame(()=>ii(o)),n},pitch:(e,t)=>ai(e,t),detect:(e,t)=>ni(e,t),settled:e=>{let t=Nt(e);return!t||!q(t).frame?Promise.resolve():new Promise(r=>q(t).waiting.push(r))},format:(e,t)=>{if(!(!e||typeof t!="function")){$t[e]=t;for(let r of z(`.tacho[data-init][data-format="${CSS.escape(e)}"]`).toArray())r._tacho&&(eo(r),_e(r,q(r).status,ce(r)))}}};si();new MutationObserver(si).observe(document,{childList:!0,subtree:!0});var io=globalThis.df$,so=io&&io.shadcn&&io.shadcn.shared;if(!so||so.abi!=="0.9.14")throw new Error("defuss-shadcn: runtime incomplete; load core before component scripts, or load all alone");var{defussGlobals:Wl,defussQuery:Vl,componentState:Hl,bindComponent:Gl}=so,jt=Wl(),co=Vl(),It=["default"],Xl='chart: echarts is not loaded - add <script src="https://cdn.jsdelivr.net/npm/echarts@6.1.0/dist/echarts.min.js"><\/script> before chart.js';function Kl(){let e=globalThis.echarts;if(!e)throw new Error(Xl);return e}var Ce=e=>typeof e=="object"&&e!==null&&!Array.isArray(e);function Ft(e,t){let r={...e};for(let[o,a]of Object.entries(t))r[o]=Ce(a)&&Ce(r[o])?Ft(r[o],a):a;return r}var fo=()=>matchMedia("(prefers-reduced-motion: reduce)").matches,he=null;function ui(e){if(!e||e==="none"||(he??=document.createElement("canvas").getContext("2d",{willReadFrequently:!0}),!he)||(he.clearRect(0,0,1,1),he.fillStyle="rgba(1, 2, 3, 0.5)",he.fillStyle=e,he.fillStyle==="rgba(1, 2, 3, 0.5)"))return null;he.fillRect(0,0,1,1);let[t,r,o,a]=he.getImageData(0,0,1,1).data;return[t,r,o,a/255]}function B(e,t=1){let r=ui(e);if(!r)return"";let o=+(r[3]*t).toFixed(3);return o>=1?`rgb(${r[0]}, ${r[1]}, ${r[2]})`:`rgba(${r[0]}, ${r[1]}, ${r[2]}, ${o})`}function Jl(e,t,r=1){let o=t.startsWith("--")?getComputedStyle(e).getPropertyValue(t).trim():t;return B(o,r)}function Yl(e){for(let t=e;t;t=t.parentElement){let r=ui(getComputedStyle(t).backgroundColor);if(r&&r[3]>.5)return`rgb(${r[0]}, ${r[1]}, ${r[2]})`}return B(getComputedStyle(document.documentElement).getPropertyValue("--background").trim())||"#ffffff"}function uo(e){let t=getComputedStyle(e),r=m=>t.getPropertyValue(m).trim(),o=parseFloat(r("--chart-font-size"))||13,a=o/13,n=m=>Math.round(m*a*10)/10,i=B(t.color)||B(r("--foreground"))||"#111111",s=B(t.color,.62)||i,c=B(t.color,.28)||i,l=B(t.color,.1)||i,f=Yl(e),u=[1,2,3,4,5].map(m=>B(r(`--chart-${m}`))).filter(Boolean),g=t.fontFamily||r("--font-sans")||"system-ui, sans-serif",d={color:s,fontSize:o,fontFamily:g},p=fo(),x={nameTextStyle:{...d},nameGap:n(14),axisLabel:{...d,margin:n(10)},axisTick:{show:!1},splitArea:{show:!1}};return{...u.length>0?{color:u}:{},backgroundColor:"transparent",aria:{enabled:!0},animation:!p,animationDuration:p?0:750,animationEasing:"cubicOut",animationDurationUpdate:p?0:900,animationEasingUpdate:"cubicInOut",textStyle:{fontFamily:g,color:i,fontSize:o},title:{textStyle:{color:i,fontSize:n(16),fontWeight:600,fontFamily:g},subtextStyle:{...d}},grid:{left:n(8),right:n(20),top:n(40),bottom:n(14)},legend:{top:0,icon:"roundRect",itemWidth:n(12),itemHeight:n(12),itemGap:n(18),textStyle:{color:s,fontSize:o,fontFamily:g},inactiveColor:l,pageTextStyle:{color:s}},tooltip:{...B(r("--popover"))?{backgroundColor:B(r("--popover"))}:{},borderColor:B(r("--border"))||c,borderWidth:1,padding:[n(8),n(12)],textStyle:{color:B(r("--popover-foreground"))||i,fontSize:o,fontFamily:g},extraCssText:"border-radius: var(--radius-md, 8px); box-shadow: var(--shadow-md, 0 6px 16px rgba(0,0,0,.12));",axisPointer:{lineStyle:{color:c,width:1},crossStyle:{color:c},shadowStyle:{color:B(t.color,.05)},label:{backgroundColor:i,color:f,fontSize:o}}},categoryAxis:{...x,axisLine:{show:!0,lineStyle:{color:c,width:1}},splitLine:{show:!1}},valueAxis:{...x,axisLine:{show:!1},splitLine:{show:!0,lineStyle:{color:l,width:1}}},logAxis:{...x,axisLine:{show:!1},splitLine:{show:!0,lineStyle:{color:l,width:1}}},timeAxis:{...x,axisLine:{show:!0,lineStyle:{color:c,width:1}},splitLine:{show:!1}},bar:{barMaxWidth:n(56),itemStyle:{borderRadius:n(4)},label:{color:i,fontSize:o,fontFamily:g}},line:{symbol:"circle",symbolSize:n(7),lineStyle:{width:n(2.5),cap:"round",join:"round"},label:{color:i,fontSize:o,fontFamily:g,textBorderWidth:0},endLabel:{color:i,fontSize:o,fontFamily:g,textBorderWidth:0}},scatter:{symbolSize:n(12),label:{color:i,fontSize:o,fontFamily:g}},pie:{itemStyle:{borderColor:f,borderWidth:n(2),borderRadius:n(4)},label:{color:i,fontSize:o,fontFamily:g},labelLine:{lineStyle:{color:c}}},sunburst:{itemStyle:{borderColor:f,borderWidth:n(1.5)},label:{fontSize:o}},treemap:{itemStyle:{borderColor:f,borderWidth:n(2),gapWidth:n(2)},label:{fontSize:o},breadcrumb:{show:!1}},sankey:{label:{color:i,fontSize:o},lineStyle:{opacity:.35}},radar:{axisName:{color:s,fontSize:o}},visualMap:{textStyle:{color:s,fontSize:o,fontFamily:g}}}}var j=new WeakMap,Rt=new WeakMap,Ne=new Set;matchMedia("print").addEventListener("change",()=>{for(let e of Ne){let t=j.get(e);!e.isConnected||!t||t.isDisposed?.()||(t.resize({animation:{duration:0}}),t.getZr?.().flush())}});function po(e){return fo()?{...e,animation:!1}:e}var Ql=/var\(--|^\s*(?:oklch|oklab|lch|lab|hwb|color-mix|color)\(/;function Qe(e,t,r){if(typeof t=="string"){if(!Ql.test(t))return t;let o=r??getComputedStyle(e),a=t.replace(/var\((--[\w-]+)\s*(?:,\s*([^()]*))?\)/g,(n,i,s)=>o.getPropertyValue(i).trim()||(s??"").trim());return B(a)||t}if(Array.isArray(t)){let o=r??getComputedStyle(e);return t.map(a=>Qe(e,a,o))}if(Ce(t)){let o=r??getComputedStyle(e),a={};for(let[n,i]of Object.entries(t))a[n]=Qe(e,i,o);return a}return t}var mo=new WeakMap,Zl=64,ef=e=>e===!0||Ce(e)&&e.notMerge===!0;function tf(e,t){let r=t.setOption.bind(t),o={ops:[],overflow:!1};mo.set(e,o),t._rawSetOption=r,t.setOption=((a,n,i)=>{ef(n)&&(o.ops=[],o.overflow=!1),o.ops.length<Zl?o.ops.push([a,n,i]):o.overflow=!0,r(po(Qe(e,a)),n,i)})}function $e(e,t={}){let r=Kl();Rt.get(e)?.disconnect(),j.get(e)?.dispose();let o=r.init(e,uo(e),{renderer:"svg"});tf(e,o),j.set(e,o),Ne.add(e),cf(),o.setOption(t,!0);let a=0,n=new ResizeObserver(()=>{cancelAnimationFrame(a),a=requestAnimationFrame(()=>{o.isDisposed?.()||o.resize()})});return n.observe(e),Rt.set(e,n),nf(e),af(e),{instance:o,setOption:(i,s=!1)=>o.setOption(i,s),dispose:()=>{Dt?.unobserve(e),n.disconnect(),Rt.delete(e),j.delete(e),Ne.delete(e),o.dispose()}}}function rf(e){return j.get(e)}function ci(e){let t=e.store?.value?.config;return Array.isArray(t?.filters)?t.filters:[]}function of(e,t){let r={...t},o={filters:r.query?.filters??[]},a=[],n=null,i=!1,s=!1,c=null,l=null,f=()=>{},u=new Promise(h=>f=h),g=h=>{n=$e(e,h),f(n.instance)},d=()=>{let h=performance.now(),y=r.source.aggregate(o,r.aggregate);a=y.rows;let v={rows:a,matched:y.matchedRows,total:y.totalRows,ms:Math.round((performance.now()-h)*10)/10},_=typeof r.option=="function"?r.option(a,v):Ft(r.option??{},{dataset:{source:a}});return e.dispatchEvent(new CustomEvent("chart-data",{detail:{rows:v.rows,matched:v.matched,total:v.total,ms:v.ms},bubbles:!0})),_},p=()=>{if(i)return;if(n){n.setOption(d());return}let h=e.getBoundingClientRect();if(h.width&&h.height){g(d());return}c||(c=new ResizeObserver(()=>{let y=e.getBoundingClientRect();!y.width||!y.height||n||i||(c?.disconnect(),c=null,g(d()))}),c.observe(e))},x=()=>{s||(s=!0,queueMicrotask(()=>{s=!1,p()}))},m=()=>{let h=r.follow;if(!h||i||l||!h.store)return;o={filters:ci(h)};let y=JSON.stringify(o.filters);l=h.store.subscribe(()=>{let v=ci(h),_=JSON.stringify(v);_!==y&&(y=_,o={filters:v},x())})};return m(),p(),r.follow&&!l&&queueMicrotask(()=>{m(),l&&x()}),{rows:()=>a,query:h=>{o={filters:h?.filters??[]},p()},refresh:()=>p(),update:h=>{if(h.aggregate&&(r.aggregate=h.aggregate),h.option!==void 0&&(r.option=h.option),n&&h.option!==void 0){n.setOption(d(),!0);return}p()},mounted:u,dispose:()=>{i=!0,l?.(),c?.disconnect(),n?.dispose(),n=null}}}function di(e,t){let r=mo.get(e),o=t._rawSetOption;if(!r||!o||r.overflow||r.ops.length===0)return;let a=r.ops.slice();t.clear?.(),r.ops=a,r.overflow=!1;for(let[n,i,s]of a)o(po(Qe(e,n)),i,s)}var Dt;function af(e){fo()||e.closest("[data-slide]")||typeof IntersectionObserver!="function"||(Dt??=new IntersectionObserver(t=>{for(let r of t){if(!r.isIntersecting)continue;let o=r.target;Dt?.unobserve(o);let a=j.get(o);a&&o.isConnected&&!a.isDisposed?.()&&di(o,a)}},{threshold:.3}),Dt.observe(e))}var li=new WeakMap;function nf(e){if(e.classList.contains("presentation-stage"))return;let t=e.closest("[data-slide]");if(!t)return;let r=li.get(t);if(!r){r=new Set,li.set(t,r);let o=r,a=t.hasAttribute("data-active");new MutationObserver(()=>{let n=t.hasAttribute("data-active");if(n&&!a)for(let i of o){let s=j.get(i);s&&i.isConnected&&di(i,s)}a=n}).observe(t,{attributes:!0,attributeFilter:["data-active"]})}r.add(e)}function sf(e,t){t.setTheme?.(uo(e));let r=mo.get(e),o=t._rawSetOption;if(!(!r||!o||r.overflow))for(let[a,n,i]of r.ops)o(po(Qe(e,a)),n,i)}var fi=!1;function cf(){if(fi)return;fi=!0;let e=0,t=()=>{clearTimeout(e),e=setTimeout(()=>{for(let o of Ne){let a=j.get(o);if(!o.isConnected||!a||a.isDisposed?.()){Ne.delete(o);continue}sf(o,a)}},60)},r=new MutationObserver(t);r.observe(document.documentElement,{attributes:!0,attributeFilter:["class","style","data-theme"]}),document.head&&r.observe(document.head,{childList:!0,subtree:!0,characterData:!0}),matchMedia("(prefers-color-scheme: dark)").addEventListener("change",t)}function lo(e){let t=e.series;if(t===void 0)return e;let r=Array.isArray(t)?t:[t];return{...e,series:r.map(o=>o.universalTransition===void 0&&o.type!=="custom"?{...o,universalTransition:{enabled:!0}}:o)}}function lf(e,t,{loop:r=!1}={}){if(!Array.isArray(t)||t.length===0)throw new Error("chart: chartStory needs at least one option state");j.has(e)||$e(e,lo(t[0]));let o=0,a=n=>(o=r?(n%t.length+t.length)%t.length:Math.min(Math.max(n,0),t.length-1),j.get(e)?.setOption(lo(t[o]),!0),o);return{next:()=>a(o+1),prev:()=>a(o-1),go:a,index:()=>o}}var ff={animationDuration:1500,animationEasing:"cubicOut",animationDurationUpdate:1500,animationEasingUpdate:"cubicInOut"};function uf(e,{base:t={},states:r}){let o=co(e).find(":scope > .presentation-stage").get(0)??null;if(!o)throw new Error('chart: chart.deck() needs a <div class="chart presentation-stage"> child of the .presentation');if(!Ce(r)||Object.keys(r).length===0)throw new Error("chart: chart.deck() needs at least one named state");let a=Array.from(co(e).find(":scope > [data-slide]").toArray()),n=null,i=null,s=f=>{if(f===null||!(f in r)){o.removeAttribute("data-visible"),n=null;return}let u=a.find(x=>x.dataset.chartState===f);if(!j.has(o)&&u&&(o.style.color=getComputedStyle(u).color),o.setAttribute("data-visible",""),f===n)return;let g=n===null&&f===i;n=f,i=f;let d=lo(Ft(Ft(ff,t),r[f])),p=j.get(o);p?(g&&p.clear?.(),p.setOption(d,!0)):$e(o,d)},c=()=>{let f=a.find(u=>u.hasAttribute("data-active"));s(f?.dataset.chartState??null)},l=new MutationObserver(c);return a.forEach(f=>l.observe(f,{attributes:!0,attributeFilter:["data-active"]})),c(),{show:s,state:()=>n,dispose:()=>{l.disconnect(),Rt.get(o)?.disconnect(),j.get(o)?.dispose(),j.delete(o),Ne.delete(o),o.removeAttribute("data-visible")}}}function df(e,t,r={}){if(!It.includes(t))throw new Error(`chart: unknown state "${t}" (supported: ${It.join(", ")})`);if(Ce(r.option)){let o=j.get(e);o?o.setOption(r.option,!0):$e(e,r.option)}}var pi=Hl({component:"chart",states:It,apply:(e,t)=>df(e,t.name,t.config),read:(e,t)=>({name:e.dataset.stateName||"default",config:{...t.config}}),markup:(e,t)=>(t.name,void 0)});jt.chartApi=pi;jt.chartStates=It;jt.chart={mount:$e,instance:rf,theme:uo,color:Jl,deck:uf,bind:of};jt.chartStory=lf;function mi(){co(".chart:not([data-init])").toArray().forEach(e=>{e.dataset.init="",Gl(e,pi);let t=()=>{if(j.has(e))return;let r=e.getAttribute("data-chart");if(!r)return;let o=e.getBoundingClientRect();if(o.width===0||o.height===0)return;let a;try{a=JSON.parse(r)}catch(n){throw new Error(`chart: invalid JSON in data-chart - ${n instanceof Error?n.message:n}`)}$e(e,a)};new ResizeObserver(t).observe(e),t()})}mi();new MutationObserver(mi).observe(document,{childList:!0,subtree:!0});var ho=globalThis.df$,bo=ho&&ho.shadcn&&ho.shadcn.shared;if(!bo||bo.abi!=="0.9.14")throw new Error("defuss-shadcn: runtime incomplete; load core before component scripts, or load all alone");var{defussGlobals:pf,defussQuery:mf,componentState:hf,bindComponent:gf}=bo,Gt=pf(),O=mf(),Ti=["default","paused"],vf=`#version 300 es
in vec2 a_position;
out vec2 v_uv;
void main() { v_uv = a_position * .5 + .5; gl_Position = vec4(a_position, 0., 1.); }`,bf=`#version 300 es
precision highp float;
precision highp int;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_delta;
uniform vec2 u_pointer;
uniform float u_hover;
uniform vec3 u_colors[8];
uniform int u_color_count;
uniform vec4 u_background;
uniform sampler2D u_image;
uniform float u_has_image;
uniform float u_seed;
uniform float u_pixel_ratio;
uniform vec2 u_frame;
uniform vec3 u_taps[8];
uniform int u_tap_count;
uniform float u_temporal;
in vec2 v_uv;
out vec4 fragColor;
#define PI 3.14159265
#define TAU 6.28318531
uint ihash(uint x) { x ^= x >> 16; x *= 0x7feb352du; x ^= x >> 15; x *= 0x846ca68bu; x ^= x >> 16; return x; }
uint cellHash(vec2 p) { uvec2 q = uvec2(ivec2(floor(p))); return ihash(q.x + ihash(q.y + ihash(uint(u_seed) + 7u))); }
float hash12(vec2 p) { return float(cellHash(p)) / 4294967295.; }
vec2 hash22(vec2 p) { uint h = cellHash(p); return vec2(float(h), float(ihash(h))) / 4294967295.; }
vec3 hash33(vec3 p) {
  uvec3 q = uvec3(ivec3(floor(p)));
  uint h = ihash(q.x + ihash(q.y + ihash(q.z + ihash(uint(u_seed) + 7u))));
  uint h2 = ihash(h);
  return vec3(float(h), float(h2), float(ihash(h2))) / 4294967295.;
}
float gnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * f * (f * (f * 6. - 15.) + 10.);
  float a = dot(hash22(i) * 2. - 1., f);
  float b = dot(hash22(i + vec2(1., 0.)) * 2. - 1., f - vec2(1., 0.));
  float c = dot(hash22(i + vec2(0., 1.)) * 2. - 1., f - vec2(0., 1.));
  float d = dot(hash22(i + 1.) * 2. - 1., f - 1.);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y) * 1.5;
}
float gnoise3(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  vec3 u = f * f * f * (f * (f * 6. - 15.) + 10.);
  float n000 = dot(hash33(i) * 2. - 1., f);
  float n100 = dot(hash33(i + vec3(1., 0., 0.)) * 2. - 1., f - vec3(1., 0., 0.));
  float n010 = dot(hash33(i + vec3(0., 1., 0.)) * 2. - 1., f - vec3(0., 1., 0.));
  float n110 = dot(hash33(i + vec3(1., 1., 0.)) * 2. - 1., f - vec3(1., 1., 0.));
  float n001 = dot(hash33(i + vec3(0., 0., 1.)) * 2. - 1., f - vec3(0., 0., 1.));
  float n101 = dot(hash33(i + vec3(1., 0., 1.)) * 2. - 1., f - vec3(1., 0., 1.));
  float n011 = dot(hash33(i + vec3(0., 1., 1.)) * 2. - 1., f - vec3(0., 1., 1.));
  float n111 = dot(hash33(i + 1.) * 2. - 1., f - 1.);
  return mix(mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y), mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y), u.z) * 1.4;
}
float fbm(vec2 p, int octaves) {
  float s = 0., a = .5;
  for (int i = 0; i < 8; i++) {
    if (i >= octaves) break;
    s += a * gnoise(p);
    p = mat2(1.6, 1.2, -1.2, 1.6) * p + 7.13;
    a *= .5;
  }
  return s;
}
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
float aspect() { return u_resolution.x / u_resolution.y; }
vec2 centered() { return (v_uv - .5) * vec2(aspect(), 1.); }
vec3 srgbToLinear(vec3 c) { return mix(c / 12.92, pow((c + .055) / 1.055, vec3(2.4)), step(.04045, c)); }
vec3 linearToSrgb(vec3 c) { c = max(c, 0.); return mix(c * 12.92, 1.055 * pow(c, vec3(1. / 2.4)) - .055, step(.0031308, c)); }
vec3 toOklab(vec3 srgb) {
  vec3 c = srgbToLinear(srgb);
  vec3 lms = vec3(dot(c, vec3(.4122214708, .5363325363, .0514459929)), dot(c, vec3(.2119034982, .6806995451, .1073969566)), dot(c, vec3(.0883024619, .2817188376, .6299787005)));
  lms = sign(lms) * pow(abs(lms), vec3(1. / 3.));
  return vec3(dot(lms, vec3(.2104542553, .7936177850, -.0040720468)), dot(lms, vec3(1.9779984951, -2.4285922050, .4505937099)), dot(lms, vec3(.0259040371, .7827717662, -.8086757660)));
}
vec3 fromOklab(vec3 lab) {
  vec3 lms = vec3(dot(lab, vec3(1., .3963377774, .2158037573)), dot(lab, vec3(1., -.1055613458, -.0638541728)), dot(lab, vec3(1., -.0894841775, -1.2914855480)));
  lms = lms * lms * lms;
  return linearToSrgb(vec3(dot(lms, vec3(4.0767416621, -3.3077115913, .2309699292)), dot(lms, vec3(-1.2684380046, 2.6097574011, -.3413193965)), dot(lms, vec3(-.0041960863, -.7034186147, 1.7076147010))));
}
vec3 mixOk(vec3 a, vec3 b, float t) { return fromOklab(mix(toOklab(a), toOklab(b), t)); }
int colorCount() { return max(u_color_count, 1); }
vec3 color(int i) { return u_colors[clamp(i, 0, colorCount() - 1)]; }
vec3 ramp(float t) {
  int n = colorCount();
  float x = clamp(t, 0., 1.) * float(n - 1);
  int i = int(min(floor(x), float(n - 1)));
  return mixOk(color(i), color(i + 1), x - float(i));
}
vec3 rampCycle(float t) {
  int n = colorCount();
  float x = fract(t) * float(n);
  int i = int(floor(x));
  return mixOk(color(i), color((i + 1) % n), x - float(i));
}
vec3 dither(vec3 c) { return c + (hash12(gl_FragCoord.xy) - .5) / 255.; }
vec4 image(vec2 uv) { return texture(u_image, uv); }
vec4 backdrop() { return vec4(u_background.rgb * u_background.a, u_background.a); }
vec4 over(vec3 c, float a) { return vec4(c * a, a) + backdrop() * (1. - a); }
float sdRoundBox(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.)) + min(max(q.x, q.y), 0.) - r; }
`,ze=["var(--chart-1)","var(--chart-2)","var(--chart-3)","var(--chart-4)","var(--chart-5)"],Ut={"mesh-gradient":{params:{distortion:.8,swirl:.35,grain:0},colors:ze,still:3.5,fragment:`uniform float u_distortion, u_swirl, u_grain;
void main() {
  float a = aspect(), t = u_time * .18;
  vec2 p = v_uv * vec2(a, 1.);
  vec2 q = p + u_distortion * .22 * vec2(gnoise(p * 1.3 + vec2(t, -t * .8)), gnoise(p * 1.3 + vec2(-t * .7, t) + 5.2));
  vec2 c = vec2(a * .5, .5), d = q - c;
  q = c + rot(u_swirl * 2.2 * exp(-dot(d, d) * 3.) * sin(t * 1.3)) * d;
  vec3 lab = vec3(0.);
  float wsum = 0.;
  int n = colorCount();
  for (int i = 0; i < 8; i++) {
    if (i >= n) break;
    float f = float(i);
    vec2 pt = vec2(a * (.5 + .38 * sin(t * (.9 + .17 * f) + f * 2.4)), .5 + .38 * cos(t * (.7 + .13 * f) + f * 1.9));
    float w = 1. / pow(length(q - pt) + .04, 3.);
    lab += toOklab(u_colors[i]) * w;
    wsum += w;
  }
  vec3 col = fromOklab(lab / wsum);
  col += (hash12(gl_FragCoord.xy + floor(u_time * 24.) * 37.) - .5) * u_grain * .25;
  fragColor = vec4(dither(col), 1.);
}`},"grain-gradient":{params:{softness:.8,grain:.5,zoom:1},colors:["var(--background)","var(--chart-1)","var(--chart-3)","var(--chart-5)"],still:2,fragment:`uniform float u_softness, u_grain, u_zoom;
void main() {
  float t = u_time * .12;
  vec2 p = centered() * 2.2 / max(u_zoom, .05);
  float f = .5 + .45 * fbm(p * .6 + vec2(t * .6, -t * .4), 3);
  f = mix(f, 1.05 - v_uv.y + .14 * sin(v_uv.x * 3. + t * 2.) + .08 * sin(v_uv.x * 7. - t * 3.), .62);
  f += (hash12(gl_FragCoord.xy + floor(u_time * 18.) * 41.) - .5) * u_grain * .55;
  int n = colorCount();
  float x = clamp(f, 0., 1.) * float(n - 1);
  int i = int(min(floor(x), float(n) - 1.5));
  float s = max(u_softness, .001) * .5;
  vec3 col = mixOk(color(i), color(i + 1), smoothstep(.5 - s, .5 + s, x - float(i)));
  col *= 1. + (hash12(gl_FragCoord.xy * 1.7 + 11.) - .5) * u_grain * .3;
  fragColor = vec4(dither(col), 1.);
}`},warp:{params:{zoom:1,warp:1,contrast:1.15},colors:["#0f0c29","#4b2a8c","#e0548c","#ffb36b","#fff4d6"],still:6,fragment:`uniform float u_zoom, u_warp, u_contrast;
void main() {
  float t = u_time * .06;
  vec2 p = centered() * 3. / max(u_zoom, .05);
  vec2 q = vec2(fbm(p + vec2(0., t), 5), fbm(p + vec2(5.2, 1.3) - t, 5));
  vec2 r = vec2(fbm(p + u_warp * 3. * q + vec2(1.7, 9.2) + t * 1.5, 5), fbm(p + u_warp * 3. * q + vec2(8.3, 2.8) - t, 5));
  float f = fbm(p + u_warp * 3. * r, 5);
  float x = clamp((.5 + .9 * f - .5) * max(u_contrast, 0.) + .5, 0., 1.);
  vec3 col = ramp(x);
  col = mixOk(col, color(colorCount() - 1), clamp(dot(r, r) * .5, 0., .45));
  col *= .82 + .3 * clamp(length(q), 0., 1.);
  fragColor = vec4(dither(col), 1.);
}`},"neuro-noise":{params:{zoom:1,brightness:1},colors:["#3d5afe","#7cf8ff","#ffffff"],background:"#04050d",still:4,fragment:`uniform float u_zoom, u_brightness;
void main() {
  vec2 p = centered() * 1.6 / max(u_zoom, .05);
  float t = u_time * .35;
  vec2 acc = vec2(0.), res = vec2(0.);
  float s = 6.;
  for (int j = 0; j < 14; j++) {
    p = rot(1.) * p;
    acc = rot(1.) * acc;
    vec2 layer = p * s + float(j) + acc - t;
    acc += sin(layer);
    res += (.5 + .5 * cos(layer)) / s;
    s *= 1.2;
  }
  float n = res.x + res.y;
  float glow = pow(max(n - .5, 0.) * 1.9, 2.6) * u_brightness * 1.6;
  glow *= smoothstep(1.15, .15, length(centered() * vec2(.9, 1.2)));
  vec3 col = mix(u_background.rgb, color(0), clamp(glow * 1.6, 0., 1.));
  col = mix(col, color(1), clamp(glow - .45, 0., 1.));
  col = mix(col, color(2), clamp(glow - 1.2, 0., 1.));
  fragColor = over(dither(col), max(clamp(glow * 1.6, 0., 1.), u_background.a));
}`},dithering:{params:{pixel:3,reveal:.18,contrast:1.2},colors:["var(--foreground)","var(--background)"],sortColors:!0,image:"image",still:2.5,fragment:`uniform float u_pixel, u_reveal, u_contrast;
float bayer8(vec2 cell) {
  ivec2 c = ivec2(mod(cell, 8.));
  int x = c.x ^ c.y, y = c.y;
  int v = ((x & 1) << 5) | ((y & 1) << 4) | ((x & 2) << 2) | ((y & 2) << 1) | ((x & 4) >> 1) | ((y & 4) >> 2);
  return (float(v) + .5) / 64.;
}
float scene(vec2 uv) {
  if (u_has_image > .5) return dot(image(uv).rgb, vec3(.2126, .7152, .0722));
  float t = u_time * .15;
  vec2 p = (uv - .5) * vec2(aspect(), 1.);
  float f = .5 + .55 * fbm(p * 2.2 + vec2(t, t * .7), 4);
  vec2 c = .28 * vec2(sin(t * 1.3), cos(t));
  return clamp(mix(f, 1.1 - length(p - c) * 1.5, .55), 0., 1.);
}
void main() {
  float px = max(u_pixel, 1.) * u_pixel_ratio;
  vec2 cell = floor(gl_FragCoord.xy / px);
  vec2 uv = (cell + .5) * px / u_resolution;
  float lum = clamp((scene(uv) - .5) * max(u_contrast, 0.) + .5, 0., 1.);
  int n = max(colorCount(), 2);
  float x = lum * float(n - 1);
  int i = int(min(floor(x), float(n) - 1.5));
  vec3 dithered = color(x - float(i) > bayer8(cell) ? i + 1 : i);
  float d = length((v_uv - u_pointer) * vec2(aspect(), 1.));
  float show = u_hover * (1. - smoothstep(u_reveal * .75, u_reveal, d));
  vec3 original = u_has_image > .5 ? image(v_uv).rgb : ramp(clamp((scene(v_uv) - .5) * u_contrast + .5, 0., 1.));
  fragColor = vec4(mix(dithered, original, show), 1.);
}`},"god-rays":{params:{origin_x:.5,origin_y:1.08,density:1,intensity:1,spread:1},colors:["#fff3d1","#ffd08a","#ffe7ba","#c9dcff"],background:"#0a0b12",still:2,fragment:`uniform float u_origin_x, u_origin_y, u_density, u_intensity, u_spread;
float rayNoise(float ang, float freq, float t) { return .5 + .5 * gnoise(vec2(cos(ang), sin(ang)) * freq + vec2(t, -t * .7)); }
void main() {
  float a = aspect(), t = u_time * .2;
  vec2 o = mix(vec2(u_origin_x * a, u_origin_y), vec2(u_pointer.x * a, u_pointer.y), u_hover * .85);
  vec2 d = v_uv * vec2(a, 1.) - o;
  float r = length(d), ang = atan(d.y, d.x);
  float dens = max(u_density, .1);
  float rays = pow(rayNoise(ang, 3. * dens, t), 3.) * .9
    + pow(rayNoise(ang, 7. * dens, -t * 1.3 + 3.), 4.) * .7
    + pow(rayNoise(ang, 15. * dens, t * 1.7 + 7.), 5.) * .5;
  float fall = exp(-r * 1.1 / max(u_spread, .05));
  float core = exp(-r * r * 9.);
  float light = (rays * fall * 1.5 + core * 1.1) * u_intensity;
  vec3 tint = rampCycle(ang / TAU * 2. + t * .05);
  vec3 glow = tint * light;
  vec4 bg = backdrop();
  vec3 col = bg.rgb + glow * (1. - .35 * bg.rgb);
  float alpha = max(bg.a, clamp(max(glow.r, max(glow.g, glow.b)), 0., 1.));
  fragColor = vec4(min(dither(col), vec3(alpha)), alpha);
}`},aurora:{params:{intensity:1,stars:1,height:1},colors:["#3cffb0","#25c9ff","#8b5cff","#ff6fb5"],background:"#040714",still:6,fragment:`uniform float u_intensity, u_stars, u_height;
void main() {
  float a = aspect(), t = u_time * .08;
  vec2 uv = v_uv, p = uv * vec2(a, 1.);
  vec3 bg = u_background.rgb;
  vec3 col = mix(bg * 1.8 + .015, bg * .7, uv.y);
  vec2 sc = gl_FragCoord.xy / u_pixel_ratio / 3.;
  float h = hash12(sc);
  float star = step(.996, h) * (.55 + .45 * sin(u_time * 2. + hash12(sc + 17.) * 40.));
  col += star * smoothstep(.25, .95, uv.y) * u_stars * .8;
  vec3 light = vec3(0.);
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float base = (.34 + fi * .11) / max(u_height, .3) + .1 * fbm(vec2(p.x * .5 + fi * 3.7, t * .7 + fi), 3);
    float x = p.x * (1.1 + fi * .35) + t * (1. + fi * .4) + fi * 10.;
    float y0 = base + .07 * sin(x * 1.3 + t * 3.) + .05 * gnoise(vec2(x * 1.6, t * 2.));
    float above = uv.y - y0;
    float band = smoothstep(-.012, .025, above) * exp(-max(above, 0.) * (4.2 - fi * .8));
    float rays = .35 + .65 * pow(.5 + .5 * gnoise(vec2(x * 11., t * 4. + fi * 5.)), 2.);
    vec3 c = mixOk(color(i), color(i + 1), clamp(above * 2.5, 0., 1.));
    light += c * band * rays * (1. - fi * .22);
  }
  col += light * u_intensity * .9;
  col += light * light * .25 * u_intensity;
  fragColor = vec4(dither(col), 1.);
}`},"pulsing-border":{params:{thickness:2,softness:1,spots:3,pulse:.6},colors:["var(--chart-1)","var(--chart-2)","var(--chart-4)","var(--chart-3)"],still:1.2,fragment:`uniform float u_thickness, u_softness, u_spots, u_pulse;
void main() {
  vec2 fc = v_uv * u_resolution, c = u_resolution * .5;
  vec2 half_ = max(c - u_frame.x, vec2(1.));
  float d = sdRoundBox(fc - c, half_, min(u_frame.y, min(half_.x, half_.y)));
  float ang = atan(fc.y - c.y, (fc.x - c.x) * u_resolution.y / u_resolution.x);
  float t = u_time;
  float travel = pow(.5 + .5 * cos(ang * max(floor(u_spots), 1.) - t * 1.6), 4.);
  float pulse = 1. - u_pulse * .45 * (.5 - .5 * sin(t * 2.4));
  float th = max(u_thickness, .5) * u_pixel_ratio;
  float line = 1. - smoothstep(th * .5, th * .5 + u_pixel_ratio, abs(d));
  float glowR = max(u_frame.x * .7 * max(u_softness, .05), u_pixel_ratio);
  // outside, the glow reaches zero before the canvas ends (u_frame.x past the frame) - exp alone left about a quarter of
  // it at the edge, a hard rectangle around every pulsing border
  float glow = d > 0. ? exp(-d / glowR) * (1. - smoothstep(u_frame.x * .5, u_frame.x, d)) : exp(d / (glowR * .35));
  float energy = (.35 + .9 * travel) * pulse;
  vec3 col = rampCycle(ang / TAU + t * .04);
  float alpha = clamp(line * (.8 + .2 * travel) + glow * energy * .9, 0., 1.);
  vec3 lit = mix(col, vec3(1.), line * travel * .35);
  fragColor = over(lit, alpha);
}`},hologram:{params:{intensity:.85,scanlines:.6,sparkle:1},colors:["#ff8fd8","#8fe3ff","#b7ffcf","#fff3a0","#c9a8ff"],background:"#1a1726",image:"image",still:1.5,fragment:`uniform float u_intensity, u_scanlines, u_sparkle;
void main() {
  float t = u_time * .3;
  vec2 p = centered();
  vec2 tilt = mix(vec2(sin(t * 1.1), cos(t * .8)) * .4, (u_pointer - .5) * 1.4, u_hover);
  vec3 base = u_has_image > .5 ? image(v_uv).rgb : mix(u_background.rgb * .7, u_background.rgb * 1.6 + .03, v_uv.y);
  float bands = dot(p, vec2(.7, .45)) * 2.4 + tilt.x * 1.2 - tilt.y * .8 + .2 * gnoise(p * 3. + t);
  vec3 foil = rampCycle(bands);
  float sheen = exp(-pow((dot(p, normalize(vec2(1., -.6))) - tilt.x * .7 + tilt.y * .35) * 2.6, 2.));
  vec2 sp = gl_FragCoord.xy / u_pixel_ratio / 14.;
  vec2 sf = fract(sp) - .5;
  float sh = hash12(sp);
  float glint = max(1. - length(sf) * 2.2, 0.);
  glint = pow(glint, 4.) + .7 * (exp(-abs(sf.x) * 40.) + exp(-abs(sf.y) * 40.)) * glint;
  float sparkle = step(.93, sh) * glint * pow(.5 + .5 * sin(u_time * 2.5 + sh * 60. + tilt.x * 14.), 6.);
  float lum = dot(base, vec3(.299, .587, .114));
  vec3 col = base * (1. - .15 * u_intensity);
  vec3 film = foil * (.22 + .6 * sheen) * u_intensity * (.45 + .4 * lum);
  col = 1. - (1. - col) * (1. - film);
  col += foil * sheen * .25 * u_intensity;
  col += sparkle * u_sparkle * 1.4;
  col *= 1. - u_scanlines * .1 * (.5 + .5 * sin(gl_FragCoord.y / u_pixel_ratio * 2.2 + u_time * 4.));
  fragColor = vec4(dither(clamp(col, 0., 1.)), 1.);
}`},metaballs:{params:{count:7,size:1,gloss:1},colors:ze,background:"var(--background)",still:3,fragment:`uniform float u_count, u_size, u_gloss;
void main() {
  float a = aspect(), t = u_time * .35;
  vec2 p = v_uv * vec2(a, 1.);
  float field = 0.;
  vec3 lab = vec3(0.);
  int n = int(clamp(u_count, 1., 16.));
  for (int i = 0; i < 16; i++) {
    if (i >= n) break;
    float f = float(i);
    vec2 c = vec2(a * (.5 + .28 * sin(t * (.6 + .11 * f) + f * 1.7)), .5 + .27 * sin(t * (.5 + .13 * f) + f * 2.9 + 1.));
    float r = (.1 + .055 * (.5 + .5 * sin(f * 3.7))) * u_size * (1. + .12 * sin(t * 2. + f));
    vec2 d = p - c;
    float k = r * r / (dot(d, d) + r * r * .08);
    field += k;
    lab += toOklab(color(i % colorCount())) * k;
  }
  if (u_hover > .001) {
    vec2 d = p - u_pointer * vec2(a, 1.);
    float r = .13 * u_size, k = r * r / (dot(d, d) + r * r * .08) * u_hover;
    field += k;
    lab += toOklab(color(0)) * k;
  }
  vec3 col = fromOklab(lab / max(field, 1e-5));
  float aa = fwidth(field) * 1.2;
  float inside = smoothstep(1. - aa, 1. + aa, field);
  float h = clamp(1. - 1. / max(field, 1e-3), 0., 1.);
  vec3 nrm = normalize(vec3(-vec2(dFdx(h), dFdy(h)) * u_resolution.y * .05, 1.));
  vec3 L = normalize(vec3(-.45, .55, .7));
  float spec = pow(max(dot(reflect(-L, nrm), vec3(0., 0., 1.)), 0.), 28.) * u_gloss;
  col = col * (.74 + .26 * dot(nrm, L)) + spec * .5;
  fragColor = over(dither(col), inside);
}`},"liquid-metal":{params:{repetition:3,distortion:.6,bevel:1,shift:0},colors:["#fbfcfd","#a7adb6","#23262c","#d9dee5","#646a74","#f3f5f8"],image:"mask",still:2,fragment:`uniform float u_repetition, u_distortion, u_bevel, u_shift;
// a picture's relief: its alpha blurred over two rings - high inside, falling smoothly to the edge
float relief(vec2 uv) {
  float acc = 0., rad = .02 + .025 * u_bevel;
  for (int i = 0; i < 8; i++) {
    float an = float(i) * TAU / 8. + .2;
    vec2 o = vec2(cos(an) / aspect(), sin(an)) * rad;
    acc += image(uv + o).a + image(uv + o * .45).a;
  }
  return smoothstep(0., 1., acc / 16.);
}
float height(vec2 uv, out float mask) {
  if (u_has_image > .5) {
    mask = image(uv).a;
    return relief(uv);
  }
  vec2 p = centered();
  float t = u_time * .2;
  float d = pow(pow(abs(p.x), 4.) + pow(abs(p.y), 4.), .25) - .32 + .012 * gnoise(p * 3. + t);
  float px = 1.5 / u_resolution.y;
  mask = smoothstep(px, -px, d);
  return smoothstep(0., .16 * u_bevel + .02, -d);
}
vec3 chrome(float s) {
  int n = colorCount();
  float x = fract(s) * float(n);
  int i = int(floor(x));
  return mixOk(color(i), color((i + 1) % n), smoothstep(.12, .88, x - float(i)));
}
void main() {
  float mask;
  float h = height(v_uv, mask);
  vec2 g = vec2(dFdx(h), dFdy(h));
  if (u_has_image > .5) {
    // central differences: smooth where dFdx would step per pixel quad
    vec2 e = 1.5 / u_resolution;
    g = vec2(relief(v_uv + vec2(e.x, 0.)) - relief(v_uv - vec2(e.x, 0.)), relief(v_uv + vec2(0., e.y)) - relief(v_uv - vec2(0., e.y))) / 3.;
  }
  g *= u_resolution.y * .03 * u_bevel;
  vec3 n = normalize(vec3(-g, 1.));
  float t = u_time * .25 + u_shift;
  vec2 p = centered();
  float flow = u_distortion * (.25 * gnoise(p * 2.2 + vec2(t * .8, -t * .5)) + .12 * gnoise(p * 5. - t));
  float s = ((p.y * .9 + p.x * .35) + flow) * u_repetition + n.x * 1.4 + n.y * 2.2 - t;
  float ca = .05 * (1. - n.z) * 6.;
  vec3 col = vec3(chrome(s + ca).r, chrome(s).g, chrome(s - ca).b);
  col = mix(col, vec3(1.), pow(1. - n.z, 2.) * .25);
  fragColor = over(dither(col), mask);
}`},water:{params:{caustics:.8,refraction:.5,zoom:1},colors:["#0a4d68","#18a0b4","#e6fbff"],image:"image",still:3,fragment:`uniform float u_caustics, u_refraction, u_zoom;
float waveH(vec2 x, float t) { return gnoise(x + vec2(t * .35, t * .2)) * .6 + gnoise(x * 2.1 + vec2(-t * .3, t * .45)) * .3 + gnoise(x * 4.3 + t * .6) * .1; }
float cellEdge(vec2 x, float t) {
  vec2 i = floor(x), f = fract(x);
  float f1 = 8., f2 = 8.;
  for (int y = -1; y <= 1; y++) for (int xx = -1; xx <= 1; xx++) {
    vec2 o = vec2(float(xx), float(y));
    vec2 h = hash22(i + o);
    vec2 r = o + .5 + .4 * sin(t * .6 + TAU * h) - f;
    float d = dot(r, r);
    if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
  }
  return sqrt(f2) - sqrt(f1);
}
void main() {
  float t = u_time;
  vec2 p = centered() * 3. / max(u_zoom, .05);
  float e = .02;
  vec2 g = vec2(waveH(p + vec2(e, 0.), t) - waveH(p - vec2(e, 0.), t), waveH(p + vec2(0., e), t) - waveH(p - vec2(0., e), t)) / (2. * e);
  vec2 uv = v_uv + g * u_refraction * .02;
  vec3 base = u_has_image > .5 ? image(uv).rgb : mixOk(color(0), color(1), smoothstep(-.3, 1.2, uv.y + .12 * g.x));
  float c1 = pow(1. - smoothstep(0., .32, cellEdge(p * 1.6 + g * .35, t)), 3.);
  float c2 = pow(1. - smoothstep(0., .28, cellEdge(p * 2.7 - g * .25 + 3., t * 1.2)), 3.);
  float caus = (c1 + c2 * .6) * u_caustics;
  vec3 col = base * (.82 + .3 * caus) + color(2) * caus * .32;
  col += .05 * dot(g, vec2(.6, .8));
  fragColor = vec4(dither(col), 1.);
}`},"fluted-glass":{params:{flutes:14,distortion:.7,angle:0,shade:.6},colors:["#ff5f6d","#ffc371","#47cacc","#5b5bd6"],background:"#f2ede6",image:"image",still:2,fragment:`uniform float u_flutes, u_distortion, u_angle, u_shade;
vec3 behind(vec2 uv) {
  if (u_has_image > .5) return image(uv).rgb;
  float a = aspect(), t = u_time * .2;
  vec2 p = uv * vec2(a, 1.);
  vec3 lab = vec3(0.);
  float ws = 0.;
  int n = colorCount();
  for (int i = 0; i < 8; i++) {
    if (i >= n) break;
    float f = float(i);
    vec2 c = vec2(a * (.5 + .4 * sin(t * (.7 + .2 * f) + f * 2.)), .5 + .4 * cos(t * (.6 + .15 * f) + f * 1.3));
    float w = 1. / pow(length(p - c) + .05, 2.5);
    lab += toOklab(u_colors[i]) * w;
    ws += w;
  }
  return fromOklab(lab / max(ws, 1e-4));
}
void main() {
  float a = aspect(), ang = u_angle * PI / 180.;
  vec2 dir = vec2(cos(ang), sin(ang));
  vec2 p = v_uv * vec2(a, 1.);
  float count = max(u_flutes, 1.);
  float cell = fract(dot(p, dir) * count / a) - .5;
  float w = a / count;
  vec2 off = dir * (-cell * w * u_distortion * 1.6);
  vec2 uv = v_uv + vec2(off.x / a, off.y);
  vec2 ca = dir * .004 * u_distortion;
  vec3 col = vec3(behind(uv + vec2(ca.x / a, ca.y)).r, behind(uv).g, behind(uv - vec2(ca.x / a, ca.y)).b);
  col *= 1. - u_shade * pow(abs(cell) * 2., 3.) * .55;
  col += u_shade * .16 * smoothstep(.16, 0., abs(cell + .22));
  fragColor = vec4(dither(col), 1.);
}`},fluid:{params:{curl:24,dissipation:.45,radius:.4,shading:.6},colors:["#ff4d6d","#ffb703","#3a86ff","#8338ec","#06d6a0"],background:"#07070c",interactive:!0,still:0,fragment:""},"dot-orbit":{params:{spacing:26,size:.5,orbit:.4},colors:ze,background:"var(--background)",still:2,fragment:`uniform float u_spacing, u_size, u_orbit;
void main() {
  float sp = max(u_spacing, 4.) * u_pixel_ratio;
  vec2 fc = gl_FragCoord.xy / sp;
  vec2 cell = floor(fc), f = fract(fc) - .5;
  vec2 mid = u_resolution / sp * .5, ptr = u_pointer * u_resolution / sp;
  float t = u_time, aa = 1.2 / sp;
  vec4 col = backdrop();
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 o = vec2(float(x), float(y)), id = cell + o;
    float h = hash12(id), h2 = hash12(id + 31.7);
    float ang = t * (.4 + h) * (h2 > .5 ? 1. : -1.) + h * TAU;
    vec2 c = o + u_orbit * .5 * vec2(cos(ang), sin(ang));
    float wave = .5 + .5 * sin(t * 1.2 - length(id - mid) * .32 + h * 1.5);
    float r = u_size * .5 * (.3 + .7 * wave);
    r *= 1. + u_hover * .9 * exp(-dot(id - ptr, id - ptr) * .03);
    float m = 1. - smoothstep(-aa, aa, length(f - c) - r);
    col = mix(col, vec4(ramp(fract(h + length(id - mid) * .02 - t * .02)), 1.), m);
  }
  fragColor = vec4(dither(col.rgb), col.a);
}`},topography:{params:{lines:12,thickness:1,zoom:1,relief:.8},colors:["var(--chart-1)","var(--chart-3)","var(--chart-5)"],background:"var(--background)",still:4,fragment:`uniform float u_lines, u_thickness, u_zoom, u_relief;
void main() {
  float t = u_time * .05, z = 2.5 / max(u_zoom, .05);
  vec2 p = centered() * z;
  float h = fbm(p * .7 + vec2(t, t * .6), 4) + .4 * fbm(p * .35 - t * .5, 2);
  vec2 pp = (u_pointer - .5) * vec2(aspect(), 1.) * z;
  h += u_hover * .55 * exp(-dot(p - pp, p - pp) * 2.5);
  float hn = clamp(h * .6 + .5, 0., 1.);
  vec3 nrm = normalize(vec3(-vec2(dFdx(h), dFdy(h)) * u_resolution.y / z * .12 * u_relief, 1.));
  float lit = clamp(dot(nrm, normalize(vec3(-.5, .6, .62))), 0., 1.);
  vec3 col = mixOk(u_background.rgb, ramp(hn), .22 + .26 * hn) * (.8 + .3 * lit);
  float c = h * u_lines;
  float dist = abs(fract(c - .5) - .5) / max(fwidth(c), 1e-4);
  float major = step(mod(floor(c + .5), 5.), .5);
  float lw = max(u_thickness, .3) * u_pixel_ratio * (1. + major);
  float line = 1. - smoothstep(lw * .5, lw * .5 + 1., dist);
  col = mix(col, mixOk(ramp(hn), color(colorCount() - 1), .6), line * (.6 + .3 * major));
  fragColor = vec4(dither(col), 1.);
}`},trails:{params:{decay:.978,brush:1,flow:1},colors:["#ff6b6b","#ffd93d","#6bcbff","#c77dff"],background:"#08080d",interactive:!0,still:0,fragment:""},orb:{params:{size:1,iridescence:1,wobble:1},colors:["#cfd9ff","#1b1530","#ff7ad9","#7ee8ff"],background:"#0c0a15",cost:.75,still:2,fragment:`uniform float u_size, u_iridescence, u_wobble;
float t3;
float surface(vec3 q) { return length(q) - .78 * u_size - u_wobble * .07 * gnoise3(q * 2.2 + t3); }
vec3 env(vec3 d) {
  vec3 c = mixOk(color(1), color(0), smoothstep(-.6, 1., d.y));
  c += pow(max(dot(d, normalize(vec3(-.5, .7, .5))), 0.), 20.) * 1.3;
  c += color(2) * pow(max(dot(d, normalize(vec3(.85, -.15, .3))), 0.), 5.) * .7;
  c += color(3) * pow(max(dot(d, normalize(vec3(-.9, -.3, -.1))), 0.), 4.) * .45;
  return c;
}
vec3 thinFilm(float cosT, float thick) {
  float opd = 2. * 1.33 * thick * sqrt(max(1. - (1. - cosT * cosT) / 1.769, 0.));
  return .5 + .5 * cos(TAU * opd / vec3(650., 532., 450.));
}
void main() {
  vec2 p = centered() * 2.;
  float t = u_time * .3;
  t3 = t;
  vec3 ro = vec3(0., 0., 3.), rd = normalize(vec3(p, -2.2));
  vec2 look = mix(vec2(sin(t * .7) * .25, cos(t * .5) * .12), (u_pointer - .5) * vec2(1.4, .9), u_hover);
  mat2 ry = rot(look.x), rx = rot(look.y);
  ro.xz = ry * ro.xz; rd.xz = ry * rd.xz;
  ro.yz = rx * ro.yz; rd.yz = rx * rd.yz;
  float R = .78 * u_size;
  vec3 bg = u_background.rgb + color(2) * .16 * exp(-dot(p, p) * 1.1) + color(3) * .06 * exp(-dot(p - vec2(.6, .5), p - vec2(.6, .5)) * 2.);
  bg *= 1. - .4 * exp(-pow((p.y + R * 1.25) / .07, 2.) - p.x * p.x * 2.5);
  vec3 col = bg;
  float b = dot(ro, rd), c = dot(ro, ro) - pow(R * 1.2, 2.), disc = b * b - c;
  if (disc > 0.) {
    float tt = max(-b - sqrt(disc), 0.), mind = 1e3;
    bool hit = false;
    vec3 pos;
    for (int i = 0; i < 40; i++) {
      pos = ro + rd * tt;
      float d = surface(pos);
      mind = min(mind, d);
      if (d < .0015) { hit = true; break; }
      tt += d * .85;
      if (tt > -b + sqrt(disc)) break;
    }
    float px = 2.5 * tt / (u_resolution.y * 1.1);
    float cover = hit ? 1. : 1. - smoothstep(0., px, mind);
    if (cover > 0.) {
      vec2 e = vec2(.002, 0.);
      vec3 n = normalize(vec3(surface(pos + e.xyy) - surface(pos - e.xyy), surface(pos + e.yxy) - surface(pos - e.yxy), surface(pos + e.yyx) - surface(pos - e.yyx)));
      float cosT = clamp(dot(n, -rd), 0., 1.);
      float F = .04 + .96 * pow(1. - cosT, 5.);
      vec3 refl = env(reflect(rd, n)), refr = env(refract(rd, n, 1. / 1.45)) * .85;
      vec3 s = mix(refr, refl, F);
      vec3 film = thinFilm(cosT, 380. + 260. * gnoise3(pos * 1.6 + t * .7));
      s = mix(s, s * film * 1.5 + film * .12, u_iridescence * (.35 + .65 * (1. - cosT)));
      s += pow(max(dot(reflect(rd, n), normalize(vec3(-.5, .7, .5))), 0.), 90.) * 1.6;
      col = mix(bg, s, cover);
    }
  }
  fragColor = vec4(dither(col), 1.);
}`},galaxy:{params:{arms:3,twist:2.6,stars:1,tilt:.55},colors:["#ffd9a0","#7fb2ff","#ff6fcf","#ffffff"],background:"#02030a",still:5,fragment:`uniform float u_arms, u_twist, u_stars, u_tilt;
float stars(vec2 x, float density, float seed) {
  vec2 id = floor(x), f = fract(x) - .5;
  vec2 o = (hash22(id + seed) - .5) * .7;
  float on = step(1. - density, hash12(id + seed + 7.));
  float tw = .55 + .45 * sin(u_time * (1. + hash12(id + seed + 3.) * 3.) + hash12(id - seed) * 30.);
  return on * tw * smoothstep(.12, 0., length(f - o));
}
void main() {
  vec2 p = centered() * 1.7;
  float t = u_time * .04;
  vec2 par = (u_pointer - .5) * u_hover;
  vec2 q = rot(t) * (p - par * .2);
  q.y /= max(u_tilt, .2);
  q = rot(-.5) * q;
  float r = length(q), ang = atan(q.y, q.x);
  float phase = max(floor(u_arms), 1.) * (ang + u_twist * log(r + .03)) + t * 2.;
  float armD = pow(.5 + .5 * cos(phase), 2.5);
  float disk = exp(-r * 2.1);
  float dust = fbm(q * 3. + t * 4., 4);
  float arm = armD * disk * (.65 + .45 * dust) * smoothstep(0., .25, r);
  float neb = pow(clamp(fbm(q * 1.6 - t * 3., 4) * .5 + .5, 0., 1.), 2.) * disk * 1.4;
  float core = exp(-r * r * 26.) + .45 * exp(-r * 6.);
  vec3 col = u_background.rgb + color(1) * arm * 2.1 + color(2) * neb * armD * 1.2 + color(0) * core * 1.25;
  col *= 1. - .55 * smoothstep(.2, .7, dust) * pow(.5 + .5 * cos(phase + .9), 4.) * disk;
  float st = 0.;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    st += stars(gl_FragCoord.xy / u_pixel_ratio / (12. + fi * 8.) + par * (fi + 1.) * 4., .14 * u_stars, fi * 13.) * (1. - fi * .25);
  }
  col += st * color(3) * .85;
  col += color(1) * step(.997, hash12(floor(gl_FragCoord.xy / u_pixel_ratio))) * arm * 3.;
  fragColor = vec4(dither(1. - exp(-col * 1.25)), 1.);
}`},waves:{params:{height:1,choppy:1,camera:1},colors:["#03253a","#0f7d8c","#f6c49c","#35548a","#fff0d4"],cost:.75,still:4,fragment:`uniform float u_height, u_choppy, u_camera;
vec3 ocean(vec2 x, float t) {
  float h = 0., amp = .3 * u_height, freq = .5;
  vec2 g = vec2(0.), dir = normalize(vec2(1., .35));
  for (int i = 0; i < 7; i++) {
    float ph = dot(dir, x) * freq + t * sqrt(9.8 * freq) * .7 + float(i) * 1.7;
    float k = max(u_choppy, .05) * 1.4;
    float w = exp((sin(ph) - 1.) * k);
    h += amp * w;
    g += amp * w * cos(ph) * k * freq * dir;
    dir = rot(1.1) * dir;
    amp *= .6;
    freq *= 1.75;
  }
  return vec3(h, g);
}
vec3 sky(vec3 d) {
  vec3 sun = normalize(vec3(-.25, .12, 1.));
  vec3 c = mixOk(color(2), color(3), smoothstep(0., .55, d.y));
  c += color(4) * (pow(max(dot(d, sun), 0.), 400.) * 3. + pow(max(dot(d, sun), 0.), 12.) * .35);
  return c;
}
void main() {
  vec2 p = centered() * 2.;
  float t = u_time;
  vec2 look = (u_pointer - .5) * vec2(.5, .25) * u_hover;
  vec3 ro = vec3(t * .2, 1.4 * max(u_camera, .2), 0.);
  vec3 rd = normalize(vec3(p.x, p.y - .3, 1.8));
  rd.xz = rot(look.x) * rd.xz;
  rd.yz = rot(-look.y) * rd.yz;
  vec3 sun = normalize(vec3(-.25, .12, 1.));
  vec3 col;
  if (rd.y > -.002) col = sky(rd);
  else {
    float top = .6 * u_height, tt = (ro.y - top) / -rd.y, prevT = tt, prevD = 1.;
    for (int i = 0; i < 56; i++) {
      vec3 pos = ro + rd * tt;
      float d = pos.y - ocean(pos.xz, t).x;
      if (d < .002 * tt) { tt = mix(prevT, tt, prevD / max(prevD - d, 1e-4)); break; }
      prevT = tt;
      prevD = d;
      tt += max(d * .7, .015 * tt);
      if (tt > 140.) break;
    }
    vec3 pos = ro + rd * tt;
    vec3 o = ocean(pos.xz, t);
    vec3 n = normalize(mix(vec3(-o.y, 1., -o.z), vec3(0., 1., 0.), smoothstep(8., 90., tt)));
    float F = .02 + .98 * pow(1. - max(dot(n, -rd), 0.), 5.);
    vec3 water = mixOk(color(0), color(1), clamp(o.x / max(.6 * u_height, .01) * 1.3 + .1, 0., 1.)) * (.45 + .55 * max(dot(n, sun), 0.));
    water += color(1) * pow(max(dot(rd, sun), 0.), 3.) * clamp(o.x, 0., 1.) * .6;
    col = mix(water, sky(reflect(rd, n)), F);
    col += color(4) * pow(max(dot(reflect(rd, n), sun), 0.), 420.) * 3.;
    col += smoothstep(.5, .95, o.x / max(.6 * u_height, .01)) * .18;
    col = mix(col, sky(vec3(rd.x, .01, rd.z)), 1. - exp(-tt * .018));
  }
  fragColor = vec4(dither(col), 1.);
}`},plasma:{params:{zoom:1,warp:1},colors:["#ff006e","#fb5607","#ffbe0b","#3a86ff","#8338ec"],still:2,fragment:`uniform float u_zoom, u_warp;
void main() {
  vec2 p = centered() * 3. / max(u_zoom, .05);
  float t = u_time * .4;
  p += u_warp * .35 * vec2(sin(p.y * 1.3 + t), cos(p.x * 1.1 - t));
  float v = sin(p.x * 1.7 + t) + sin(p.y * 1.9 - t * .8) + sin((p.x + p.y) * 1.2 + t * .6)
    + sin(length(p - vec2(sin(t * .7), cos(t * .5)) * 1.5) * 2.6);
  fragColor = vec4(dither(rampCycle(v * .125 + .5 + t * .05)), 1.);
}`},bokeh:{params:{size:1,density:.7,blur:.5},colors:["#ffb347","#ff6f91","#9b8cff","#5ad1ff","#ffe08a"],background:"#0b0a14",still:4,fragment:`uniform float u_size, u_density, u_blur;
void main() {
  vec2 uv = centered();
  vec3 col = u_background.rgb * u_background.a;
  for (int l = 0; l < 4; l++) {
    float fl = float(l);
    float sc = (2.6 + fl * 1.6) / max(u_size, .1);
    vec2 p = uv * sc + vec2(fl * 7.3, -u_time * (.05 + fl * .025));
    vec2 c = floor(p), f = fract(p) - .5;
    vec2 h = hash22(c + vec2(fl * 31., fl * 17.));
    if (h.x > u_density * .9) continue;
    vec2 o = (hash22(c + 51.) - .5) * .5;
    float r = .16 + .2 * h.y;
    float d = length(f - o) - r;
    float soft = (.015 + u_blur * .1) * (1. + fl * .4);
    float disc = 1. - smoothstep(-soft, soft, d);
    float rim = exp(-abs(d) * 26.) * .45 * disc;
    float tw = .65 + .35 * sin(u_time * (.4 + h.x) + h.y * 20.);
    col += color(int(h.y * 8.) % colorCount()) * (disc * .32 + rim) * tw / (1. + fl * .55);
  }
  fragColor = vec4(dither(col), 1.);
}`},ripple:{params:{strength:.6,decay:.6,drops:.6},colors:["#0d5c75","#3fb8c7","#d8f6f2"],image:"image",interactive:!0,still:1.2,fragment:`uniform float u_strength, u_decay, u_drops;
// one ring: its height and slope (d/duv) at p, started at c at time t0
vec3 ring(vec2 p, vec2 c, float t0) {
  float age = u_time - t0;
  if (age < 0. || age > 7.) return vec3(0.);
  vec2 k = vec2(aspect(), 1.);
  vec2 dp = (p - c) * k;
  float r = length(dp) + 1e-4;
  float x = r - age * .32;
  float env = exp(-x * x * 90.) * exp(-age * max(u_decay, .05)) / (1. + r * 5.);
  float h = sin(x * 55.) * env;
  float dh = 55. * cos(x * 55.) * env;
  return vec3(h, dp / r * k * dh);
}
void main() {
  vec2 p = v_uv;
  vec3 w = vec3(0.);
  float rate = max(u_drops, 0.);
  if (rate > 0.) {
    float now = floor(u_time * rate);
    for (int i = 0; i < 5; i++) {
      float slot = now - float(i);
      w += ring(p, hash22(vec2(slot, 7.)) * .8 + .1, slot / rate);
    }
  }
  for (int i = 0; i < 8; i++) {
    if (i >= u_tap_count) break;
    w += ring(p, u_taps[i].xy, u_taps[i].z);
  }
  vec2 off = w.yz * u_strength * .006;
  vec3 base = u_has_image > .5 ? image(p + off).rgb
    : mixOk(color(0), color(1), smoothstep(-.2, 1.2, p.y + off.y * 3. + gnoise((p + off) * 3. + u_time * .05) * .15));
  vec3 n = normalize(vec3(-w.yz * u_strength * .05, 1.));
  float spec = pow(max(dot(n, normalize(vec3(-.35, .45, .82))), 0.), 40.);
  fragColor = vec4(dither(base * (1. + w.x * u_strength * .5) + color(2) * spec * .7), 1.);
}`},voronoi:{params:{scale:5,lead:.06,glow:.6},colors:["#d1495b","#edae49","#00798c","#30638e","#7f5a83","#8ab17d"],still:1,fragment:`uniform float u_scale, u_lead, u_glow;
void main() {
  vec2 p = centered() * max(u_scale, .5);
  float t = u_time * .25;
  vec2 n = floor(p), f = fract(p);
  float f1 = 8., f2 = 8.;
  vec2 id = vec2(0.), r1 = vec2(0.);
  for (int j = -1; j <= 1; j++)
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 o = .5 + .36 * sin(t + TAU * hash22(n + g));
      vec2 r = g + o - f;
      float d = dot(r, r);
      if (d < f1) { f2 = f1; f1 = d; id = n + g; r1 = r; } else if (d < f2) f2 = d;
    }
  // the distance to the cell's border: the second pass measures it along the bisectors
  float edge = 8.;
  for (int j = -2; j <= 2; j++)
    for (int i = -2; i <= 2; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 o = .5 + .36 * sin(t + TAU * hash22(n + g));
      vec2 r = g + o - f;
      if (dot(r1 - r, r1 - r) > 1e-5) edge = min(edge, dot(.5 * (r1 + r), normalize(r - r1)));
    }
  float light = .7 + .3 * gnoise(p * .3 + t * .4) + u_glow * .45 * (1. - smoothstep(0., .5, sqrt(f1)));
  vec3 glass = rampCycle(hash12(id) + t * .03) * light;
  float aa = fwidth(edge) * 1.2;
  vec3 col = mix(vec3(.05, .045, .04), glass, smoothstep(u_lead - aa, u_lead + aa, edge));
  fragColor = vec4(dither(col), 1.);
}`},halftone:{params:{cell:8,angle:15,contrast:1.2},colors:["var(--foreground)","var(--background)"],image:"image",still:1,fragment:`uniform float u_cell, u_angle, u_contrast;
void main() {
  vec2 px = gl_FragCoord.xy / u_pixel_ratio;
  float cs = max(u_cell, 2.);
  mat2 R = rot(radians(u_angle));
  vec2 g = R * px / cs;
  vec2 c = floor(g) + .5;
  vec2 center = (transpose(R) * (c * cs)) * u_pixel_ratio / u_resolution;
  float l;
  if (u_has_image > .5) l = dot(image(clamp(center, 0., 1.)).rgb, vec3(.2126, .7152, .0722));
  else {
    vec2 q = (center - .5) * vec2(aspect(), 1.);
    l = .5 + .5 * sin(length(q) * 9. - u_time * 1.4) * cos(q.x * 3. + u_time * .5);
  }
  l = clamp((l - .5) * u_contrast + .5, 0., 1.);
  float d = length(g - c) - sqrt(1. - l) * .74;
  float aa = fwidth(length(g - c)) * .8;
  fragColor = vec4(dither(mix(color(1), color(0), 1. - smoothstep(-aa, aa, d))), 1.);
}`},kaleidoscope:{params:{segments:8,zoom:1,twist:1},colors:ze,image:"image",still:3,fragment:`uniform float u_segments, u_zoom, u_twist;
void main() {
  vec2 p = centered() * 1.4 / max(u_zoom, .05);
  float t = u_time * .15;
  float r = length(p), a = atan(p.y, p.x) + t;
  float seg = TAU / max(floor(u_segments), 2.);
  a = mod(a, seg);
  a = abs(a - seg * .5);
  vec2 q = rot(t * u_twist) * (vec2(cos(a), sin(a)) * r) + vec2(t * .7, 0.);
  vec3 col;
  if (u_has_image > .5) col = image(abs(fract(q * .5 + .5) * 2. - 1.)).rgb;
  else {
    float n = fbm(q * 2.2, 4);
    col = rampCycle(n * .8 + r * .3 - t * .4) * (.75 + .35 * smoothstep(0., .6, abs(sin(n * 8.))));
  }
  col *= 1. - smoothstep(.7, 1.4, r) * .35;
  fragColor = vec4(dither(col), 1.);
}`},clouds:{params:{cover:.5,softness:.6,zoom:1},colors:["#2f6fc4","#a9d1f5","#ffffff","#8f9db3"],still:6,fragment:`uniform float u_cover, u_softness, u_zoom;
void main() {
  vec2 p = centered() * 2.4 / max(u_zoom, .05) + vec2(u_time * .05, 0.);
  vec3 sky = mixOk(color(1), color(0), pow(v_uv.y, .8));
  vec2 w = vec2(fbm(p * .5 + u_time * .02, 3), fbm(p * .5 - u_time * .015 + 4.2, 3));
  float n = fbm(p + w * .7, 6) * .5 + .5;
  float c = smoothstep(1. - u_cover, 1. - u_cover + .35 * max(u_softness, .05), n);
  // light from above: a sample nearer the sun is thinner - the cloud's top is lit, its base shaded
  float lit = fbm(p + w * .7 + vec2(.08, .16), 6) * .5 + .5;
  vec3 cloud = mixOk(color(3), color(2), clamp(.55 + (n - lit) * 5., 0., 1.));
  fragColor = vec4(dither(mix(sky, cloud, c)), 1.);
}`},fire:{params:{intensity:1,height:.75,zoom:1},colors:["#1a0402","#b3160b","#f2590d","#ffb21f","#fff3c4"],background:"#0a0505",still:2,fragment:`uniform float u_intensity, u_height, u_zoom;
void main() {
  vec2 p = centered() * 3. / max(u_zoom, .05);
  float t = u_time;
  vec2 q = vec2(p.x, p.y - t * 1.5);
  float n = fbm(q * vec2(1.4, 1.) + vec2(0., -t * .3), 5) * .5 + .5;
  float n2 = fbm(q * 2.3 + 3.7, 4) * .5 + .5;
  float shape = 1. - v_uv.y / max(u_height, .1);
  float f = clamp(shape * 1.05 + n * .9 + n2 * .35 - .75, 0., 1.);
  f = clamp(pow(f, 1.3) * u_intensity * .92, 0., 1.);
  fragColor = over(dither(ramp(f)), clamp(f * 2.4, 0., 1.));
}`},starfield:{params:{density:.6,warp:.4,twinkle:.5},colors:["#ffffff","#cfe0ff","#ffe2c4","#b9c7ff"],background:"#03040a",still:3,fragment:`uniform float u_density, u_warp, u_twinkle;
void main() {
  vec2 uv = centered();
  vec3 col = u_background.rgb * u_background.a;
  vec2 dir = normalize(uv + 1e-4);
  for (int l = 0; l < 6; l++) {
    float fl = float(l);
    float z = fract(fl / 6. + u_time * .045 * (.4 + u_warp));
    float fade = smoothstep(0., .35, z) * smoothstep(1., .85, z);
    vec2 p = uv * mix(14., 1.6, z * z) + vec2(fl * 13.7, fl * 7.1);
    vec2 c = floor(p), f = fract(p) - .5;
    vec2 h = hash22(c + vec2(fl * 17., 3.));
    if (h.x > u_density * .9) continue;
    vec2 d = f - (hash22(c + 41.) - .5) * .7;
    float along = dot(d, dir), across = dot(d, vec2(-dir.y, dir.x));
    float len = .01 + u_warp * z * z * .35;
    float s = exp(-across * across * 2600.) * exp(-pow(max(abs(along) - len, 0.), 2.) * 2600.);
    float tw = 1. - u_twinkle * .6 * (.5 + .5 * sin(u_time * (2. + h.y * 5.) + h.x * 30.));
    col += color(int(h.y * 8.) % colorCount()) * s * fade * tw * (.5 + z * 1.4);
  }
  fragColor = vec4(dither(col), 1.);
}`},silk:{params:{folds:4,sheen:.8,zoom:1},colors:["#2b0f3a","#7a2e8e","#e07bb5","#ffe3f1"],ranges:{folds:[1,8,.1],sheen:[0,2,.01]},aa:"fxaa",still:3,fragment:`uniform float u_folds, u_sheen, u_zoom;
// the cloth's height: a sine sheet carried by a few slow folds
float silk(vec2 p) {
  float t = u_time * .18;
  vec2 q = p;
  for (int i = 1; i < 4; i++) {
    float fi = float(i);
    q += .45 / fi * vec2(sin(fi * q.y * .9 + t * fi * .7 + 1.7 * fi), cos(fi * q.x * .8 - t * fi * .5));
  }
  float k = max(u_folds, .2);
  return sin(q.x * k + q.y * .6) * .6 + sin(q.x * k * .5 - q.y * .4 + t) * .4;
}
void main() {
  vec2 p = centered() * 2. / max(u_zoom, .05);
  float e = .003;
  float h = silk(p);
  vec3 n = normalize(vec3(-(silk(p + vec2(e, 0.)) - h) / e, -(silk(p + vec2(0., e)) - h) / e, 1.6));
  vec3 l = normalize(vec3(-.4, .6, .7));
  // wrapped diffuse: the folds' shadows stay colored, as on cloth
  float diff = dot(n, l) * .5 + .5;
  float spec = pow(max(dot(reflect(-l, n), vec3(0., 0., 1.)), 0.), 50.) * u_sheen;
  vec3 col = ramp(clamp(diff * diff * .95 + h * .08, 0., 1.)) + color(colorCount() - 1) * spec * .7;
  fragColor = vec4(dither(col), 1.);
}`},nebula:{params:{density:.9,stars:.6,zoom:1},colors:["#3a0ca3","#f72585","#4cc9f0","#ffffff"],background:"#05030d",ranges:{density:[0,1.5,.01]},still:8,fragment:`uniform float u_density, u_stars, u_zoom;
void main() {
  vec2 p = centered() * 2.2 / max(u_zoom, .05);
  float t = u_time * .03;
  vec2 w = vec2(fbm(p + t, 4), fbm(p * 1.3 - t + 5.2, 4));
  float n = fbm(p * 1.1 + w * 1.6 + vec2(t, -t * .5), 6) * .5 + .5;
  float n2 = fbm(p * 2.3 - w + 9.1, 5) * .5 + .5;
  float gas = smoothstep(.35, .95, n) * u_density;
  vec3 tint = mixOk(color(0), color(1), smoothstep(.35, .8, n));
  tint = mixOk(tint, color(2), smoothstep(.55, .95, n2) * .8);
  vec3 col = u_background.rgb * u_background.a + tint * gas * 1.25;
  // dark lanes of dust across the glow
  col *= 1. - smoothstep(.55, .85, fbm(p * 1.8 + w * 2. + 3.3, 5) * .5 + .5) * .55 * min(u_density, 1.);
  // stars on a pixel grid: the same size at every resolution
  vec2 px = gl_FragCoord.xy / u_pixel_ratio;
  for (int l = 0; l < 2; l++) {
    float cell = 22. + float(l) * 17.;
    vec2 sp = px / cell + float(l) * 7.7;
    vec2 c = floor(sp), f = fract(sp) - .5;
    vec2 h = hash22(c + float(l) * 13.);
    if (h.x > u_stars * .5) continue;
    vec2 o = (hash22(c + 7.) - .5) * .7;
    float d = length(f - o) * cell;
    float tw = .55 + .45 * sin(u_time * (1. + h.y * 3.) + h.x * 40.);
    col += color(3) * exp(-d * d * (.9 + float(l) * .6)) * tw * (1. - float(l) * .35);
  }
  fragColor = vec4(dither(col), 1.);
}`},prism:{params:{spread:.6,sparkle:.5,angle:-12},colors:["#ffffff","#a0c4ff","#ffc6ff","#caffbf"],background:"#0b0b12",still:2,fragment:`uniform float u_spread, u_sparkle, u_angle;
// a wavelength 0..1 as a color: red, yellow, green, cyan, blue, violet
vec3 spectrum(float x) { return clamp(abs(mod(x * 5. + vec3(0., 4., 2.), 6.) - 3.) - 1., 0., 1.); }
void main() {
  vec2 p = rot(radians(u_angle)) * centered();
  float t = u_time * .2;
  vec3 col = u_background.rgb * u_background.a;
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    // a beam bending slowly; across it the light splits into its colors
    float y = p.y + .22 * sin(p.x * (1.2 + fi * .3) + t * (1. + fi * .2) + fi * 2.) - (fi - 1.5) * .26;
    float w = (.045 + .025 * sin(t + fi * 1.7)) * (1. + u_spread);
    float x = y / w;
    float inside = 1. - smoothstep(.7, 1.25, abs(x));
    float glow = exp(-y * y * 30.) * .22;
    float pulse = .65 + .35 * sin(p.x * 2.6 + t * 2. + fi);
    col += (spectrum(clamp(x * .5 + .5, 0., 1.)) * inside * .75 + color(i) * glow) * pulse;
  }
  col += color(0) * pow(max(gnoise(p * 7. + t), 0.), 4.) * u_sparkle * 1.5;
  fragColor = vec4(dither(col), 1.);
}`},matrix:{params:{size:16,rain:1,trail:.6},colors:["#0b3d1a","#26ff6a","#d9ffe4"],background:"#020a04",ranges:{size:[8,40,1],rain:[.1,3,.05],trail:[.1,1,.01]},still:6,fragment:`uniform float u_size, u_rain, u_trail;
void main() {
  // the glyph grid in CSS px, counted from the top
  float cs = max(u_size, 6.);
  vec2 cell = vec2(cs * .64, cs);
  float rows = u_resolution.y / u_pixel_ratio / cell.y;
  vec2 g = vec2(gl_FragCoord.x / u_pixel_ratio, u_resolution.y / u_pixel_ratio - gl_FragCoord.y / u_pixel_ratio) / cell;
  vec2 id = floor(g), f = fract(g);
  // each column: its own speed, trail length and phase; the head falls, the trail fades behind it
  float sp = (.5 + hash12(vec2(id.x, 3.)) * .9) * max(u_rain, .02);
  float len = (6. + hash12(vec2(id.x, 9.)) * 20.) * max(u_trail, .05) * 1.6;
  float head = fract(u_time * sp * .09 + hash12(vec2(id.x, 1.))) * (rows + len + 4.) - 2.;
  float d = head - id.y;
  float trail = d >= 0. && d < len ? pow(1. - d / len, 1.6) : 0.;
  float lit = d >= 0. && d < 1. ? 1. : 0.;
  // a 5 x 7 glyph, mirrored so it reads like a character; it changes now and then (faster near the head)
  float tick = floor(u_time * (1. + 5. * lit + hash12(id) * 2.) + hash12(id + 5.) * 9.);
  vec2 q = (f - vec2(.14, .1)) / vec2(.72, .8);
  vec2 gp = floor(q * vec2(5., 7.));
  float on = 0.;
  if (q.x >= 0. && q.x < 1. && q.y >= 0. && q.y < 1.) {
    float gx = min(gp.x, 4. - gp.x);
    on = step(.48, hash12(vec2(gx + gp.y * 5., hash12(id + tick) * 97.)));
    vec2 pf = fract(q * vec2(5., 7.)) - .5;
    on *= 1. - smoothstep(.32, .5, max(abs(pf.x), abs(pf.y)));
  }
  vec3 col = u_background.rgb * u_background.a;
  float ghost = .07 * step(.3, hash12(vec2(id.x, 21.)));
  col += on * (mix(color(0), color(1), trail) * max(trail, ghost) + color(2) * lit * 1.2);
  // a soft glow around the lit trail
  col += color(1) * trail * .06;
  fragColor = vec4(dither(col), 1.);
}`},marble:{params:{veins:.4,flow:1,zoom:1},colors:["#f4f1ec","#d9d4cc","#4f535b","#c9a86a"],ranges:{veins:[0,1,.01],flow:[0,3,.05]},aa:"fxaa",still:4,fragment:`uniform float u_veins, u_flow, u_zoom;
void main() {
  vec2 p = centered() * 1.4 / max(u_zoom, .05);
  float t = u_time * .05 * u_flow;
  vec2 q = vec2(fbm(p + t, 4), fbm(p + vec2(5.2, 1.3) - t, 4));
  vec2 r = vec2(fbm(p + 2. * q + vec2(1.7, 9.2) + t * .5, 4), fbm(p + 2. * q + vec2(8.3, 2.8), 4));
  float v = fbm(p + 1.8 * r, 4);
  // veins: where a folded sine crosses zero - kept as wide as a pixel at least
  float s = abs(sin((p.x * 1.1 + p.y * .45) * 1.6 + v * 3.2));
  float w = mix(.015, .2, u_veins);
  float aa = fwidth(s);
  float vein = 1. - smoothstep(w * .4, w + aa, s);
  float halo = (1. - smoothstep(0., w * 4. + aa, s)) * .25;
  vec3 col = mixOk(color(0), color(1), clamp(v * .9 + .5, 0., 1.));
  col = mixOk(col, color(2), clamp(vein + halo, 0., 1.));
  col = mixOk(col, color(3), smoothstep(.75, 1.1, length(r)) * .35);
  fragColor = vec4(dither(col), 1.);
}`},oil:{params:{film:1,swirl:1,zoom:1},colors:["#0a0a0f","#1d1b2a","#ffffff"],ranges:{film:[0,3,.01],swirl:[0,3,.01]},still:3,fragment:`uniform float u_film, u_swirl, u_zoom;
void main() {
  vec2 p = centered() * 1.8 / max(u_zoom, .05);
  float t = u_time * .1;
  vec2 w = vec2(fbm(p * 1.2 + t, 4), fbm(p * 1.2 - t + 3.1, 4)) * u_swirl;
  float h = fbm(p + w * 1.5 + t * .3, 5) * .5 + .5;
  // thin-film interference: the thickness shifts each channel's phase differently
  float d = h * u_film * 6. + t;
  vec3 film = .5 + .5 * cos(TAU * (d + vec3(0., .33, .67)));
  vec3 base = mixOk(color(0), color(1), smoothstep(.2, .9, h));
  vec3 col = mix(base, film * mix(vec3(1.), color(2), .3), smoothstep(.3, .75, h) * .85);
  fragColor = vec4(dither(col), 1.);
}`},"op-art":{params:{rings:18,offset:.5,warp:.3},colors:["var(--foreground)","var(--background)"],ranges:{rings:[4,48,1],offset:[0,1,.01],warp:[0,1,.01]},still:1,fragment:`uniform float u_rings, u_offset, u_warp;
// one set of rings around c: 1 on a dark band, 0 on a light one, smoothed to the pixel; a gray where they get finer than a pixel
float rings(vec2 p, vec2 c) {
  float r = length(p - c) + u_warp * .05 * gnoise(p * 3. + u_time * .2);
  float s = sin(r * u_rings * TAU);
  float aa = fwidth(s);
  float fine = smoothstep(.25, .5, fwidth(r) * u_rings);
  return mix(smoothstep(-aa, aa, s), .5, fine);
}
void main() {
  vec2 p = centered();
  float t = u_time * .3;
  vec2 c = vec2(sin(t), cos(t * .7) * .7) * .2 * u_offset;
  // two sets of rings, combined as exclusive or: the moire is where they disagree
  float m = abs(rings(p, c) - rings(p, -c));
  fragColor = vec4(dither(mix(color(0), color(1), m)), 1.);
}`},lightning:{params:{bolts:2,branch:.6,glow:1},colors:["#ffffff","#8aa8ff"],background:"#070914",ranges:{bolts:[1,3,1],branch:[0,1,.01],glow:[0,2,.01]},still:.05,fragment:`uniform float u_bolts, u_branch, u_glow;
// the bolt's x at height y (centered units): a jagged path, new on every strike
float boltX(float y, float seed) {
  return (hash12(vec2(seed, 1.)) - .5) * aspect() * .9 + fbm(vec2(y * 2.6, seed), 5) * .3 + fbm(vec2(y * 11., seed * 3.), 3) * .05;
}
void main() {
  vec2 p = centered();
  float ppx = u_resolution.y / u_pixel_ratio;
  vec3 col = u_background.rgb * u_background.a + color(1) * (fbm(p * 2. + u_time * .02, 4) * .5 + .5) * .05;
  float t = u_time * .6;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    if (fi >= u_bolts) break;
    float tt = t + fi * .37;
    float strike = floor(tt);
    float ph = fract(tt);
    // not every period strikes; a strike flickers and fades
    float flash = step(.2, hash12(vec2(fi, strike))) * exp(-ph * 4.) * (.7 + .3 * step(.5, fract(ph * 11.)));
    if (flash < .002) continue;
    float seed = fi * 11.3 + strike * 7.1;
    float end = -.5 + hash12(vec2(seed, 4.)) * .4;
    float reach = smoothstep(end - .02, end + .02, p.y);
    float d = abs(p.x - boltX(p.y, seed)) * ppx;
    // a branch leaves the bolt at y0 and runs aside and down
    float y0 = .25 - hash12(vec2(seed, 6.)) * .45;
    float side = hash12(vec2(seed, 8.)) > .5 ? 1. : -1.;
    float drop = y0 - p.y;
    float bx = boltX(y0, seed) + side * drop * .7 + fbm(vec2(p.y * 9., seed + 2.), 3) * .05;
    float bmask = step(0., drop) * (1. - smoothstep(.0, .35 * u_branch, drop));
    float db = abs(p.x - bx) * ppx;
    float core = exp(-d * d * .18) * reach + exp(-db * db * .35) * bmask * .8;
    float halo = (exp(-d * .05) * reach + exp(-db * .08) * bmask * .5) * u_glow;
    col += (color(0) * core * 1.4 + color(1) * halo * .55) * flash + color(1) * flash * .05 * u_glow;
  }
  fragColor = vec4(dither(col), 1.);
}`},snow:{params:{density:.55,wind:.3,size:1},colors:["#1b2a41","#6c8ead","#ffffff"],ranges:{density:[0,1,.01],wind:[-1,1,.01],size:[.3,3,.05]},still:4,fragment:`uniform float u_density, u_wind, u_size;
void main() {
  vec2 px = gl_FragCoord.xy / u_pixel_ratio;
  vec3 col = mixOk(color(0), color(1), v_uv.y);
  for (int l = 0; l < 5; l++) {
    float fl = float(l);
    // near layers: big, fast, blurred flakes; far ones small and slow
    float cell = (110. / (1. + fl * .75)) * max(u_size, .2);
    float fall = (.9 - fl * .13) * cell * .6;
    vec2 q = px + vec2(-u_wind * fall * u_time * 1.2, fall * u_time);
    vec2 p = q / cell + fl * 3.7;
    vec2 c = floor(p), f = fract(p) - .5;
    vec2 h = hash22(c + fl * 9.);
    if (h.x > u_density) continue;
    vec2 o = (hash22(c + 3.) - .5) * .6;
    o.x += sin(u_time * (.8 + h.y) + h.x * 6.) * .12;
    float r = cell * (.03 + .025 * h.y);
    float blur = 1. + (l == 0 ? r * .6 : 0.);
    float s = 1. - smoothstep(r - blur, r + blur, length(f - o) * cell);
    col = mix(col, color(2), s * (1. - fl * .14));
  }
  fragColor = vec4(dither(col), 1.);
}`},fireflies:{params:{count:24,glow:1,drift:1},colors:["#03140d","#0b2e22","#d6ff7a"],ranges:{count:[1,40,1],glow:[0,2,.01],drift:[0,3,.05]},still:5,fragment:`uniform float u_count, u_glow, u_drift;
void main() {
  vec2 uv = v_uv * vec2(aspect(), 1.);
  float ppx = u_resolution.y / u_pixel_ratio;
  vec3 col = mixOk(color(0), color(1), smoothstep(0., 1., v_uv.y));
  for (int i = 0; i < 40; i++) {
    float fi = float(i);
    if (fi >= u_count) break;
    vec2 h = hash22(vec2(fi, 3.)), h2 = hash22(vec2(fi, 11.));
    float t = u_time * (.1 + h2.x * .15) * u_drift;
    vec2 pos = vec2(h.x * aspect(), h.y * .8 + .1) + .12 * vec2(sin(t * 2.1 + h2.y * 6.), cos(t * 1.7 + h.x * 6.));
    pos += .05 * vec2(gnoise(vec2(t, fi)), gnoise(vec2(fi, t)));
    // each one blinks on its own slow rhythm
    float blink = smoothstep(.15, 1., sin(u_time * (.7 + h2.y) + fi * 2.3) * .5 + .5);
    float d = length(uv - pos) * ppx;
    col += color(2) * (exp(-d * d * .12) * 1.1 + exp(-d * .07) * .3 * u_glow) * blink;
  }
  fragColor = vec4(dither(col), 1.);
}`},glitch:{params:{amount:.7,blocks:.5,shift:1},colors:["#ff2e63","#08d9d6","#252a34","#eaeaea"],image:"image",ranges:{amount:[0,1,.01],blocks:[0,1,.01],shift:[0,3,.05]},still:2.3,fragment:`uniform float u_amount, u_blocks, u_shift;
// the picture, or a test card of the palette without one
vec3 src(vec2 uv) {
  uv = clamp(uv, 0., 1.);
  if (u_has_image > .5) return image(uv).rgb;
  vec3 c = ramp(uv.x);
  return c * (.78 + .22 * step(.5, fract(uv.y * 9.))) * (.85 + .15 * step(.5, fract(uv.x * 23. + uv.y * 3.)));
}
void main() {
  vec2 uv = v_uv;
  float t = floor(u_time * 8.);
  // glitches come in bursts: most moments are clean
  float burst = step(.55, hash12(vec2(t, 1.))) * u_amount;
  vec2 bs = vec2(floor(mix(3., 18., u_blocks)), floor(mix(6., 40., u_blocks)));
  vec2 b = floor(uv * bs);
  float r = hash12(b + t * 3.);
  uv.x += (r > .82 ? (hash12(b + t * 7.) - .5) * .25 : 0.) * burst;
  uv.x += (hash12(vec2(floor(uv.y * 140.), t)) - .5) * .015 * burst;
  float sh = u_shift * .01 * (.25 + burst);
  vec3 col = vec3(src(uv + vec2(sh, 0.)).r, src(uv).g, src(uv - vec2(sh, 0.)).b);
  col += (hash12(gl_FragCoord.xy + t) - .5) * .14 * burst;
  if (r > .975 && burst > 0.) col = 1. - col;
  fragColor = vec4(dither(col), 1.);
}`},crt:{params:{curve:.6,scanlines:240,glow:.6},colors:["#c0c0c0","#c0c000","#00c0c0","#00c000","#c000c0","#c00000","#0000c0"],background:"#050505",image:"image",ranges:{curve:[0,1.5,.01],scanlines:[60,600,10],glow:[0,2,.01]},still:1,fragment:`uniform float u_curve, u_scanlines, u_glow;
// the picture, or color bars of the palette without one
vec3 src(vec2 uv) {
  if (u_has_image > .5) return image(clamp(uv, 0., 1.)).rgb;
  if (uv.y > .3) return color(int(uv.x * float(colorCount())));
  return vec3(uv.x) * .8 * (.6 + .4 * step(.5, fract(uv.x * 8. - u_time * .25)));
}
void main() {
  vec2 c = v_uv * 2. - 1.;
  c *= 1. + u_curve * .22 * pow(abs(c.yx), vec2(2.));
  vec2 uv = c * .5 + .5;
  float edge = min(min(uv.x, 1. - uv.x), min(uv.y, 1. - uv.y));
  float inside = smoothstep(0., fwidth(uv.y) * 1.5, edge);
  vec3 col = vec3(src(uv + vec2(.0015, 0.)).r, src(uv).g, src(uv - vec2(.0015, 0.)).b);
  // scanlines: never finer than two device pixels, so they cannot alias
  float lines = min(u_scanlines, u_resolution.y / 2.5);
  col *= .7 + .3 * sin(uv.y * lines * TAU) * .5 + .15;
  // the aperture: red, green and blue stripes, one device pixel each
  float m = mod(gl_FragCoord.x, 3.);
  col *= mix(vec3(1.), vec3(step(m, 1.), step(1., m) * step(m, 2.), step(2., m)) * .5 + .6, .45);
  vec3 bloom = (src(uv + vec2(.004, 0.)) + src(uv - vec2(.004, 0.)) + src(uv + vec2(0., .006)) + src(uv - vec2(0., .006))) * .25;
  col += bloom * u_glow * .25;
  col *= 1. + .07 * exp(-pow(fract(uv.y - u_time * .07) - .5, 2.) * 90.);
  col *= 1. - .35 * dot(c * .7, c * .7);
  fragColor = vec4(dither(mix(u_background.rgb, col * 1.15, inside)), 1.);
}`},caustics:{params:{scale:4,light:1,warp:.4},colors:["#0b4f6c","#20a4c4","#e8fbff"],ranges:{scale:[1,12,.1],light:[0,2,.01],warp:[0,1.5,.01]},aa:"fxaa",still:2,fragment:`uniform float u_scale, u_light, u_warp;
// the gap between the nearest and the second nearest of moving points: small along the cells' borders
float gap(vec2 p, float t) {
  vec2 n = floor(p), f = fract(p);
  float f1 = 8., f2 = 8.;
  for (int j = -1; j <= 1; j++)
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 r = g + .5 + .4 * sin(t + TAU * hash22(n + g)) - f;
      float d = dot(r, r);
      if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
    }
  return sqrt(f2) - sqrt(f1);
}
void main() {
  vec2 p = centered() * max(u_scale, .5);
  float t = u_time * .6;
  vec2 w = vec2(gnoise(p * .6 + t * .2), gnoise(p * .6 - t * .2 + 4.)) * u_warp;
  // two nets of light at different scales: where they meet, the light gathers
  float a = gap(p + w, t), b = gap(p * 1.6 - w + 3.1, t * 1.3);
  float light = pow(exp(-a * 8.) + exp(-b * 6.) * .6, 1.6) * u_light;
  vec3 water = mixOk(color(0), color(1), clamp(v_uv.y * .7 + gnoise(p * .4 + t * .1) * .15 + .15, 0., 1.));
  fragColor = vec4(dither(water + color(2) * light * .75), 1.);
}`},smoke:{params:{density:.8,rise:1,zoom:1},colors:["#101014","#26262e","#d9d9e3"],ranges:{density:[0,1.5,.01],rise:[0,3,.05]},still:4,fragment:`uniform float u_density, u_rise, u_zoom;
void main() {
  vec2 p = centered() * 2.4 / max(u_zoom, .05);
  float t = u_time * .25 * u_rise;
  vec2 q = vec2(p.x, p.y - t);
  vec2 w = vec2(fbm(q * .8 + vec2(0., t * .3), 4), fbm(q * .8 + 5.2, 4));
  float n = fbm(q + w * 1.8, 6) * .5 + .5;
  // lit from above: a sample nearer the light is thinner
  float lit = fbm(q + w * 1.8 + vec2(-.04, .09), 6) * .5 + .5;
  float dens = smoothstep(.38, .9, n) * u_density * (1.15 - v_uv.y * .55);
  vec3 bg = mixOk(color(0), color(1), v_uv.y);
  vec3 puff = color(2) * clamp(.65 + (n - lit) * 4., .25, 1.2);
  fragColor = vec4(dither(mix(bg, puff, clamp(dens, 0., 1.))), 1.);
}`},surface:{params:{scale:8,line:.06,bevel:.5,depth:1,tilt:.5,fog:.5,glow:1,variation:.15,light:135,elevation:45,direction:30,rotation:0},options:{pattern:["hex","checker","grid","dots","triangles","diamonds","bricks","herringbone","weave","scales","waves","truchet","maze","cubes","circuit","topography","stripes","chevron","circles","octagons","stars","stones","cells","glyphs","crosses","lattice"],material:["bevel","flat","emboss","neon","glass","chrome","ceramic","paper","holo","quilted","metal","gold","copper","wood","marble","stone","rubber","plastic","velvet","ice","lava","gem","pearl","clay","toon","glitter","wireframe","xray"],projection:["flat","tilted","floor","wall","corridor","tunnel","sphere","isometric","ceiling","hallway","column","dome","cube"],motion:["drift","none","pulse","shimmer","ripple","rotate","warp","mutate","orbit","zoom","spiral","wave","breathe","swirl","rain","cascade","flip","spin","sparkle","cycle","glitch","scan","domino","shake"]},ranges:{scale:[1,30,.5],bevel:[0,1.5,.01],depth:[0,3,.01],glow:[0,3,.01]},colors:["var(--background)","var(--chart-1)","var(--chart-2)","var(--chart-3)"],image:"image",aa:"fxaa",temporal:.6,cost:.8,still:1,fragment:`uniform float u_pattern, u_material, u_projection, u_motion;
uniform float u_scale, u_line, u_bevel, u_depth, u_tilt, u_fog, u_glow, u_variation, u_light, u_elevation, u_direction, u_rotation;
// cell ids wrap around a tunnel, a ball or a column: every pattern repeats after gPer tiles along x
float gPer = 0.;
int gMotion = 0;
vec2 wcell(vec2 c) { return gPer > 0. ? vec2(mod(c.x, gPer), c.y) : c; }
// mutate and rain: every cell re-rolls on its own beat
float epoch(vec2 c) {
  if (gMotion == 7) return floor(u_time * .35 + hash12(c * 2. + 91.) * 9.);
  if (gMotion == 14) return floor(u_time * 1.6 + hash12(c * 2. + 91.) * 9.);
  return 0.;
}
float crand(vec2 c, float k) { vec2 w = wcell(c); return hash12(w * 2. + vec2(k * 131., epoch(w) * 977.)); }
vec2 pgrad(vec2 i, float per) { if (per > 0.) i.x = mod(i.x, per); return hash22(i) * 2. - 1.; }
float pnoise(vec2 p, float per) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3. - 2. * f);
  return mix(mix(dot(pgrad(i, per), f), dot(pgrad(i + vec2(1., 0.), per), f - vec2(1., 0.)), u.x),
    mix(dot(pgrad(i + vec2(0., 1.), per), f - vec2(0., 1.)), dot(pgrad(i + 1., per), f - 1.), u.x), u.y) * 1.4;
}
float sdSeg(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0., 1.)); }
float rayDist(vec2 h, float a) { vec2 d = vec2(cos(a), sin(a)); float t = dot(h, d); return t > 0. ? abs(h.x * d.y - h.y * d.x) : length(h); }
// pointy-top hexagons with an inradius of .5: local position and cell id
vec4 hexTile(vec2 p) {
  const vec2 s = vec2(1., 1.7320508);
  vec4 hc = floor(vec4(p, p - vec2(.5, 1.)) / s.xyxy) + .5;
  vec4 h = vec4(p - hc.xy * s, p - (hc.zw + .5) * s);
  return dot(h.xy, h.xy) < dot(h.zw, h.zw) ? vec4(h.xy, hc.xy) : vec4(h.zw, hc.zw + .5);
}
float hexDist(vec2 h) { h = abs(h); return max(h.x, dot(h, vec2(.5, .8660254))); }
// moving points, one per cell: x = the distance to the nearest border (about), yz = the nearest point's cell
vec3 voro(vec2 p, float jitter) {
  vec2 n = floor(p), f = fract(p);
  float f1 = 8., f2 = 8.;
  vec2 id = n;
  for (int j = -1; j <= 1; j++)
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 r = g + .5 + (vec2(crand(n + g, 31.), crand(n + g, 32.)) - .5) * jitter - f;
      float d = dot(r, r);
      if (d < f1) { f2 = f1; f1 = d; id = n + g; } else if (d < f2) f2 = d;
    }
  return vec3((sqrt(f2) - sqrt(f1)) * .5, id);
}

// a pattern at p (tile units): x = signed distance to the raised shape (negative inside), y = its class, zw = its cell
vec4 pattern(vec2 p, int id) {
  float L = u_line;
  float d = 1.;
  float cls = 0.;
  vec2 cell = vec2(0.);
  if (id == 0) { // hex
    vec4 h = hexTile(p);
    d = hexDist(h.xy) - (.5 - L);
    cell = h.zw;
    float r = crand(cell, 1.);
    cls = r < .55 ? 0. : r < .88 ? 1. : 2.;
  } else if (id == 1) { // checker
    cell = floor(p);
    d = sdRoundBox(fract(p) - .5, vec2(.5 - L), .1 * u_bevel);
    cls = mod(cell.x + cell.y, 2.);
  } else if (id == 2) { // grid: the lines are raised, every fourth one stronger
    vec2 f = abs(fract(p) - .5);
    d = .5 - max(f.x, f.y) - L * .5;
    vec2 g = abs(fract(p * .25) - .5);
    float dm = (.5 - max(g.x, g.y)) * 4. - L * 1.1;
    if (dm < d) { d = dm; cls = 1.; }
    cell = floor(p);
  } else if (id == 3) { // dots
    cell = floor(p);
    d = length(fract(p) - .5) - .3 * (1. + (crand(cell, 3.) - .5) * u_variation * 1.5);
    cls = crand(cell, 4.) < .06 + u_variation * .6 ? 1. : 0.;
  } else if (id == 4) { // triangles
    vec2 r = vec2(p.x - p.y * .57735027, p.y * 1.1547005);
    vec2 c = floor(r), f = fract(r);
    float up = step(f.x + f.y, 1.);
    vec3 b = up > .5 ? vec3(f, 1. - f.x - f.y) : vec3(1. - f, f.x + f.y - 1.);
    d = L * .7 - min(b.x, min(b.y, b.z)) * .8660254;
    cell = c * 2. + vec2(up, 0.);
    cls = up;
  } else if (id == 5) { // diamonds
    vec2 r = rot(PI * .25) * p * 1.41421356;
    cell = floor(r);
    d = sdRoundBox(fract(r) - .5, vec2(.5 - L * 1.414), .08 * u_bevel) / 1.41421356;
    cls = mod(cell.x + cell.y, 2.);
  } else if (id == 6) { // bricks: running bond
    float row = floor(p.y);
    vec2 b = vec2(p.x * .5 + .5 * mod(row, 2.), p.y);
    cell = floor(b);
    vec2 f = fract(b) - .5;
    d = sdRoundBox(vec2(f.x * 2., f.y), vec2(1. - L, .5 - L), .06 * u_bevel);
    cls = crand(cell, 5.) < .2 + u_variation ? 1. : 0.;
  } else if (id == 7) { // herringbone: 2 x 1 bricks on a staircase, turned 45 degrees
    vec2 r = rot(PI * .25) * p * 1.41421356;
    float n0 = floor((r.x - r.y + 1.) * .25);
    d = 1e5;
    for (int i = 0; i < 2; i++) {
      float n = n0 - float(i);
      vec2 s = r - n * vec2(2., -2.);
      float k = floor(s.y);
      if (s.x >= k && s.x < k + 2.) {
        float dd = sdRoundBox(s - vec2(k + 1., k + .5), vec2(1. - L * 1.414, .5 - L * 1.414), .05);
        if (dd < d) { d = dd; cell = vec2(n * 7. + k, k); cls = 0.; }
      }
      float k2 = floor(s.x) - 2.;
      if (s.y >= k2 - 1. && s.y < k2 + 1.) {
        float dd = sdRoundBox(s - vec2(k2 + 2.5, k2), vec2(.5 - L * 1.414, 1. - L * 1.414), .05);
        if (dd < d) { d = dd; cell = vec2(n * 7. + k2, k2 + 50.); cls = 1.; }
      }
    }
    d /= 1.41421356;
  } else if (id == 8) { // weave: three strands per cell, crossing in turn
    vec2 c = floor(p), f = fract(p);
    float horiz = mod(c.x + c.y, 2.);
    vec2 g = horiz > .5 ? f : f.yx;
    float strand = floor(g.y * 3.);
    d = max((abs(fract(g.y * 3.) - .5) - .5) / 3. + L * .6, abs(g.x - .5) - .5 + L * .4);
    cell = c * 3. + vec2(strand, 0.);
    cls = horiz;
  } else if (id == 9) { // scales: rows of discs, each row over the one before it
    d = 1e5;
    float j0 = floor(p.y * 2.);
    for (int k = -1; k <= 1; k++) {
      float j = j0 + float(k);
      float x0 = .5 * mod(j, 2.);
      float i = floor(p.x - x0 + .5);
      float dd = length(p - vec2(i + x0, j * .5)) - .62;
      if (dd < 0.) { d = dd + L * 1.2; cell = vec2(i * 2. + mod(j, 2.), j); }
      else if (d > 0.) d = min(d, dd);
    }
    cls = crand(cell, 9.) < .06 + u_variation * .6 ? 1. : 0.;
  } else if (id == 10) { // waves: ribbons on a sine
    float y = p.y + .22 * sin(p.x * TAU);
    float g = length(vec2(.22 * TAU * cos(p.x * TAU), 1.));
    d = (abs(fract(y) - .5) - .38 + L) / g;
    cell = vec2(0., floor(y));
    cls = mod(cell.y, 2.);
  } else if (id == 11) { // truchet: quarter arcs, every cell turned at random
    cell = floor(p);
    vec2 f = fract(p) - .5;
    if (crand(cell, 6.) > .5) f.x = -f.x;
    float a = abs(length(f - .5) - .5), b = abs(length(f + .5) - .5);
    d = min(a, b) - (.14 - L * .3);
    cls = crand(cell, 7.) < .1 + u_variation ? 1. : 0.;
  } else if (id == 12) { // maze: one diagonal per cell
    cell = floor(p);
    vec2 f = fract(p) - .5;
    if (crand(cell, 8.) > .5) f.x = -f.x;
    d = abs(f.x + f.y) * .70710678 - (.08 + L * .5);
  } else if (id == 13) { // cubes: every hexagon three rhombi - top, left, right
    vec4 h = hexTile(p);
    float a = atan(h.y, h.x);
    float deg = mod(degrees(a) + 360., 360.);
    cls = deg > 30. && deg <= 150. ? 0. : deg > 150. && deg <= 270. ? 1. : 2.;
    float e = min(.5 - hexDist(h.xy), min(rayDist(h.xy, PI / 6.), min(rayDist(h.xy, PI * 5. / 6.), rayDist(h.xy, PI * 1.5))));
    d = L * .6 - e;
    cell = h.zw * 3. + vec2(cls, 0.);
  } else if (id == 14) { // circuit: an edge is on or off for both cells it joins, so traces always meet
    cell = floor(p);
    vec2 f = fract(p) - .5;
    float eR = step(.55, crand(cell, 11.)), eL = step(.55, crand(cell - vec2(1., 0.), 11.));
    float eT = step(.55, crand(cell, 12.)), eB = step(.55, crand(cell - vec2(0., 1.), 12.));
    float tr = 1e5;
    if (eR > .5) tr = min(tr, sdSeg(f, vec2(0.), vec2(.5, 0.)));
    if (eL > .5) tr = min(tr, sdSeg(f, vec2(0.), vec2(-.5, 0.)));
    if (eT > .5) tr = min(tr, sdSeg(f, vec2(0.), vec2(0., .5)));
    if (eB > .5) tr = min(tr, sdSeg(f, vec2(0.), vec2(0., -.5)));
    float count = eR + eL + eT + eB;
    float pad = count == 1. ? length(f) - .17 : count == 0. ? length(f) - .07 : 1e5;
    tr -= L * .9;
    d = min(tr, pad);
    cls = pad < tr ? 1. : 0.;
  } else if (id == 15) { // topography: contour lines of a noise (periodic around a tunnel)
    float per = gPer > 0. ? gPer / 3. : 0.;
    float n = pnoise(p / 3., per) * .75 + pnoise(p / 1.5 + 9.1, per * 2.) * .3;
    float v = n * 5.;
    float rv = floor(v + .5);
    float major = step(abs(mod(rv, 4.)), .5);
    d = abs(v - rv) / 4.5 - L * (.45 + major * .55);
    cls = major;
    cell = vec2(0., rv);
  } else if (id == 16) { // stripes: bands in two colors, a groove between them
    cell = vec2(0., floor(p.y));
    d = abs(fract(p.y) - .5) - (.5 - L);
    cls = mod(cell.y, 2.);
  } else if (id == 17) { // chevron: the stripes folded into zigzags
    float y = p.y - abs(fract(p.x * .5) - .5) * 2.;
    cell = vec2(0., floor(y));
    d = (abs(fract(y) - .5) - (.5 - L)) * .70710678;
    cls = mod(cell.y, 2.);
  } else if (id == 18) { // circles: rings in every cell
    cell = floor(p);
    vec2 f = fract(p) - .5;
    float r = length(f) * 3.;
    d = max((abs(fract(r) - .5) - .5 + L * 3.) / 3., length(f) - .48);
    cls = mod(floor(r), 2.);
  } else if (id == 19) { // octagons with a small square between every four
    cell = floor(p);
    vec2 a = abs(fract(p) - .5);
    float r = .5 - L;
    float dOct = max(max(a.x, a.y), (a.x + a.y) * .70710678) - r;
    vec2 g = .5 - a;
    float dSq = (g.x + g.y) * .70710678 - ((1. - r * 1.41421356) * .70710678 - L * 1.5);
    if (dSq < dOct) { d = dSq; cls = 1.; cell = floor(p + .5) + vec2(0., 500.); }
    else { d = dOct; cls = 0.; }
  } else if (id == 20) { // stars: five points, every other row moved half a cell
    float row = floor(p.y);
    vec2 q = vec2(p.x + .5 * mod(row, 2.), p.y);
    cell = floor(q);
    vec2 f = fract(q) - .5;
    float seg = TAU / 5.;
    float m = abs(mod(atan(f.x, f.y) + 4. * TAU, seg) - seg * .5) / (seg * .5);
    d = (length(f) - mix(.17, .43 - L, m)) * .7;
    cls = crand(cell, 13.) < .1 + u_variation ? 1. : 0.;
  } else if (id == 21) { // stones: rounded cobbles
    vec3 v = voro(p, .8);
    d = L * 1.6 + .02 - v.x;
    cell = v.yz;
    cls = crand(cell, 14.) < .15 + u_variation ? 1. : 0.;
  } else if (id == 22) { // cells: the raised borders of an organic net
    vec3 v = voro(p, .9);
    d = v.x - L * .7;
    cell = v.yz;
  } else if (id == 23) { // glyphs: a 5 x 7 character in every cell, mirrored so it reads like one
    cell = floor(vec2(p.x, p.y / 1.4));
    vec2 q = (vec2(fract(p.x), fract(p.y / 1.4)) - vec2(.12, .08)) / vec2(.76, .84);
    vec2 gp = floor(q * vec2(5., 7.));
    vec2 pf = fract(q * vec2(5., 7.)) - .5;
    float px = max(abs(pf.x), abs(pf.y)) - .36;
    d = .1;
    if (q.x >= 0. && q.x < 1. && q.y >= 0. && q.y < 1. && crand(cell, 15. + min(gp.x, 4. - gp.x) + gp.y * 3.) > .5) d = px * .15;
    cls = crand(cell, 40.) < .08 + u_variation * .5 ? 1. : 0.;
  } else if (id == 24) { // crosses
    cell = floor(p);
    vec2 f = abs(fract(p) - .5);
    float arm = .13 - L * .3, len = .4 - L;
    d = min(max(f.x - len, f.y - arm), max(f.x - arm, f.y - len));
    cls = mod(cell.x + cell.y, 2.);
  } else { // lattice: a diagonal trellis, a stud at every crossing
    vec2 r = rot(PI * .25) * p * 1.41421356;
    vec2 g = abs(fract(r) - .5);
    float dl = (.5 - max(g.x, g.y)) / 1.41421356 - L * .7;
    float stud = length(fract(r + .5) - .5) / 1.41421356 - (L * 1.6 + .04);
    cell = floor(r + .5);
    if (stud < dl) { d = stud; cls = 1.; } else { d = dl; cls = 0.; }
  }
  return vec4(d, cls, cell);
}
float relief(float d, float bev, int mat) {
  float x = clamp(-d / bev, 0., 1.);
  return mat == 9 ? sqrt(clamp(-d / (bev * 2.6), 0., 1.)) : x * x * (3. - 2. * x);
}
// how much of a tile the raised shape covers, per pattern: the far, averaged color
const float COVER[26] = float[26](.8, .8, .25, .3, .8, .75, .85, .8, .75, .95, .65, .45, .35, .9, .3, .2, .85, .85, .6, .85, .35, .8, .3, .3, .35, .35);
bool isLine(int pid) { return pid == 2 || pid == 11 || pid == 12 || pid == 14 || pid == 15 || pid == 22 || pid == 25; }

// the light, the view and the camera's frame, shared by the materials
vec3 gV, gLd, gUp;
vec3 env(vec3 R, vec3 sc) {
  float ry = dot(R, gUp);
  vec3 e = ry > 0. ? mix(mixOk(sc, vec3(1.), .55), mixOk(sc, vec3(.04), .25), pow(ry, .6))
    : mix(vec3(.88), color(0) * .22, pow(-ry, .4));
  e += smoothstep(.05, 0., abs(ry - .02)) * .55;
  return e + pow(max(dot(R, gLd), 0.), 24.) * 1.2;
}
// a material at one point: m = how much of the raised shape covers it, d = the distance to its edge, nl = the
// relief's normal in the plane, Nw = the same in the world, detail = 0 for the far average (no fine texture)
vec3 shade(int mat, float m, float d, float aa, vec3 nl, vec3 Nw, vec3 sc, float face, vec2 p, vec2 cell, float shine, bool line, float detail) {
  vec3 V = gV, Ld = gLd;
  vec3 H = normalize(Ld + V);
  float diff = max(dot(Nw, Ld), 0.);
  float nh = max(dot(Nw, H), 0.);
  float nv = max(dot(Nw, V), 0.);
  float spec = pow(nh, 48.);
  float fres = pow(1. - nv, 4.);
  vec3 R = reflect(-V, Nw);
  vec3 c0 = color(0);
  float t = u_time;
  vec3 col;
  switch (mat) {
    case 1: { // flat
      col = mix(c0, sc * face, m) + shine * .35 * m;
      break;
    }
    case 2: { // emboss: one color, the relief alone draws the pattern
      col = mixOk(c0, color(1), .12) * (.62 + .48 * diff) + spec * .12 + shine * .25;
      break;
    }
    case 3: { // neon: tubes along the lines and around the shapes
      float dl = line ? max(d, 0.) : abs(d);
      float core = (1. - smoothstep(0., .015 + aa * 2., dl)) * detail;
      float glow = exp(-dl * 14. / max(u_glow, .05));
      col = c0 * .07 + sc * glow * .85 * u_glow + mix(sc, vec3(1.), .65) * core + sc * shine * .5;
      break;
    }
    case 4: { // glass: tiles that bend what lies behind them
      vec2 off = nl.xy * .06;
      vec3 back = u_has_image > .5 ? image(v_uv + off).rgb : rampCycle(dot(p + off * 8., vec2(.05, .03)) + t * .02);
      vec3 inside = mix(back, sc, .3) * (.85 + .3 * diff) + spec * .9 + fres * .35;
      col = mix(mix(back * .5, c0, .5), inside, m) + shine * .3;
      break;
    }
    case 5: { // chrome: a mirror of a studio
      vec3 e = env(R, sc);
      col = mix(e * .42, e, m) * face + spec * .8 + shine * .6;
      break;
    }
    case 6: { // ceramic: glazed tiles in matte grout
      vec3 glaze = sc * face * (.45 + .6 * diff) + pow(nh, 160.) * 1.1 + fres * .2;
      vec3 grout = mixOk(c0, vec3(.9), .5) * (.8 + .2 * diff);
      col = mix(grout, glaze, m) + shine * .4 * m;
      break;
    }
    case 7: { // paper: a matte sheet, the pattern pressed and printed in
      vec3 paper = mixOk(c0, vec3(.95, .92, .85), .35) * (.84 + .22 * diff) * (1. + gnoise(p * 11.) * .04 * detail);
      col = mix(paper, paper * mix(vec3(1.), sc, .55), m * .85);
      break;
    }
    case 8: { // holo: thin-film colors that turn with the view
      float hue = dot(Nw, V) * 2.2 + dot(p, vec2(.05, .08)) + t * .08;
      vec3 rainbow = .55 + .45 * cos(TAU * (hue + vec3(0., .33, .67)));
      float sparkle = step(.985, hash12(floor(p * 14.) + floor(t * 6.))) * diff * detail;
      col = mix(mix(c0, rainbow, .25) * .8, mix(rainbow, sc, .25) * (.6 + .5 * diff) + spec * .7 + sparkle, m) + shine * .5;
      break;
    }
    case 9: { // quilted: padded cells, a stitched seam around each
      float stitch = (1. - smoothstep(0., aa * 2. + .01, abs(d + .056 * max(u_bevel, .02)))) * step(.5, fract((p.x + p.y) * 7.)) * detail;
      col = mix(c0 * .5, sc * face * (.4 + .7 * diff), m) + stitch * .35 * m;
      break;
    }
    case 10: { // metal: brushed steel, the grain along the tile
      vec3 base = mixOk(vec3(.74), sc, .22);
      float brush = gnoise(vec2(p.x * 1.5, p.y * 70.)) * detail;
      col = mix(c0 * .3 + base * .12, base * (env(R, base) * .55 + .22) * (1. + brush * .14) + spec * .5, m) + shine * .4 * m;
      break;
    }
    case 11: { // gold: a warm mirror
      vec3 gold = mixOk(vec3(1., .77, .32), sc, .12);
      col = mix(gold * .16, gold * (env(R, gold) * .7 + .12) + pow(nh, 90.) * gold * 1.2, m) + shine * .5 * m;
      break;
    }
    case 12: { // copper: a reddish mirror, a green patina in the grooves
      vec3 cu = mixOk(vec3(.93, .5, .34), sc, .1);
      vec3 patina = mixOk(vec3(.27, .62, .52), c0, .25) * (.55 + .45 * diff);
      col = mix(patina, cu * (env(R, cu) * .6 + .18) + pow(nh, 70.) * cu, m) + shine * .4 * m;
      break;
    }
    case 13: { // wood: rings across each tile, every tile cut its own way
      vec2 q = crand(cell, 41.) > .5 ? p.yx : p;
      float g = q.y * 6. + gnoise(q * vec2(.7, 4.) + cell * 3.1) * 1.4 + crand(cell, 42.) * 20.;
      float ring = mix(.5, smoothstep(.05, .45, abs(fract(g) - .5)), detail);
      vec3 light = mixOk(vec3(.8, .57, .34), sc, .14), dark = mixOk(vec3(.44, .25, .12), sc, .1);
      col = mix(dark * .4, mix(dark, light, ring) * (.55 + .55 * diff) + pow(nh, 70.) * .3, m);
      break;
    }
    case 14: { // marble: polished stone with veins
      float v = fbm(p * .45 + cell * .37, 4);
      float vein = (1. - smoothstep(0., .06 + aa * 4., abs(sin((p.x + p.y * .4) * 1.4 + v * 5.)))) * detail;
      vec3 stone = mixOk(mixOk(vec3(.95, .94, .92), sc, .1), mixOk(c0 * .3, sc, .25), vein * .75 + .1 * (1. - detail));
      col = mix(mixOk(vec3(.6), c0, .3), stone * (.72 + .33 * diff) + pow(nh, 120.) * .9 + fres * .15, m);
      break;
    }
    case 15: { // stone: rough and matte
      float n = (gnoise(p * 6.) * .5 + gnoise(p * 17.) * .25) * detail;
      vec3 base = mixOk(vec3(.56, .54, .5), sc, .25) * (.86 + n * .3);
      col = mix(c0 * .25 + base * .1, base * (.32 + .78 * diff), m);
      break;
    }
    case 16: { // rubber: dark and soft
      vec3 base = mixOk(vec3(.07), sc, .35);
      col = mix(c0 * .12, base * (.45 + .6 * diff) + pow(nh, 12.) * .1, m);
      break;
    }
    case 17: { // plastic: a clear color, a sharp white highlight
      col = mix(c0 * .6, sc * face * (.35 + .7 * diff) + pow(nh, 90.) * .9 + fres * .08, m) + shine * .4 * m;
      break;
    }
    case 18: { // velvet: dark facing you, bright at the grazing edges
      float rim = pow(1. - nv, 2.5);
      col = mix(c0 * .25, sc * (.22 + .32 * diff) + mixOk(sc, vec3(1.), .4) * rim * .85, m);
      break;
    }
    case 19: { // ice: cold, translucent, cracked
      vec3 ice = mixOk(vec3(.82, .93, 1.), sc, .2);
      float crack = (1. - smoothstep(0., .02 + aa * 2., abs(gnoise(p * 2.5 + cell * 1.7)))) * detail;
      col = mix(ice * .5, ice * (.62 + .3 * diff) - crack * .18 + spec * 1.1 + fres * .5, m);
      break;
    }
    case 20: { // lava: dark rock, the grooves glowing
      vec3 rock = mixOk(vec3(.12, .1, .1), c0, .1) * (.5 + .7 * diff) * (.85 + gnoise(p * 5.) * .2 * detail);
      vec3 hot = mix(vec3(1., .22, .02), vec3(1., .82, .3), .5 + .5 * sin(t * 1.5 + gnoise(p * .8) * 6.));
      col = mix(hot * u_glow, rock, m) + hot * exp(-abs(d) * 18.) * .45 * u_glow * m;
      break;
    }
    case 21: { // gem: faceted, a deep color, flashes of the spectrum
      vec3 disp = .5 + .5 * cos(TAU * (nv * 3. + vec3(0., .33, .67)));
      col = mix(c0 * .22, sc * .38 * (.5 + diff) + disp * fres * .7 + pow(nh, 200.) * 2.2, m);
      break;
    }
    case 22: { // pearl: soft white, a play of colors
      vec3 base = mixOk(vec3(.96, .94, .92), sc, .15);
      vec3 irid = .5 + .5 * cos(TAU * (nv * 1.5 + vec3(0., .33, .67)));
      col = mix(c0 * .5, base * (.55 + .45 * diff) + irid * .14 * (1. - nv) + pow(nh, 30.) * .35, m);
      break;
    }
    case 23: { // clay: matte, the light wrapping round
      vec3 base = mixOk(sc, vec3(.85, .6, .45), .25);
      float w = max((dot(Nw, Ld) + .5) / 1.5, 0.);
      col = mix(base * .45, base * (.28 + .75 * w), m);
      break;
    }
    case 24: { // toon: three tones and an ink outline
      float lv = diff > .6 ? 1. : diff > .25 ? .72 : .48;
      col = mix(c0, sc * face * lv + step(.97, nh) * .55, m);
      col = mix(col, vec3(.05), (1. - smoothstep(aa * 1.5, aa * 3. + .006, abs(d))) * detail);
      break;
    }
    case 25: { // glitter: flecks that twinkle
      vec2 g = floor(p * 22.);
      float fleck = step(.955, hash12(g + floor(t * 4. + hash12(g) * 4.))) * (.5 + .5 * diff) * detail;
      col = mix(c0 * .4, sc * (.4 + .6 * diff) + spec * .4 + fleck * 1.6, m) + shine * .4 * m;
      break;
    }
    case 26: { // wireframe: only the outlines and a fine mesh
      float edge = (1. - smoothstep(0., aa * 1.5 + .008, abs(d))) * detail;
      vec2 mg = abs(fract(p * 4. + .5) - .5) / 4.;
      float mesh = (1. - smoothstep(0., aa * 1.2 + .002, min(mg.x, mg.y))) * detail;
      col = c0 * .06 + sc * edge + sc * mesh * .2 * m + sc * .08 * m * (1. - detail);
      break;
    }
    case 27: { // x-ray: the slopes bright, the flat dim, on black
      vec3 bone = mixOk(vec3(.7, .9, 1.), sc, .2);
      float slope = length(nl.xy);
      col = vec3(.02, .04, .08) + bone * (m * .16 + slope * .9 + (1. - smoothstep(0., aa * 2. + .01, abs(d))) * .45 * detail);
      break;
    }
    default: { // bevel: raised tiles, lit
      vec3 tile = sc * face * (.3 + .8 * diff) + spec * .45 + shine * .4;
      col = mix(c0 * (.55 + .3 * smoothstep(0., .12, d)), tile, m);
    }
  }
  return col;
}
// the materials that glow on black
bool isDark(int mat) { return mat == 3 || mat == 20 || mat == 26 || mat == 27; }

void main() {
  gMotion = int(u_motion + .5);
  int proj = int(u_projection + .5), mat = int(u_material + .5), pid = int(u_pattern + .5);
  float t = u_time;
  float S = max(u_scale, .5);
  vec2 uv = centered();
  vec2 ptr = (u_pointer - .5) * vec2(aspect(), 1.);
  vec3 N = vec3(0., 0., 1.), T = vec3(1., 0., 0.), B = vec3(0., 1., 0.);
  vec3 rt = vec3(1., 0., 0.), up = vec3(0., 1., 0.), fw = vec3(0., 0., -1.), rd = fw;
  vec2 p;
  float dist = 0., sky = 0.;
  bool drift = gMotion == 0;
  // the drift's direction in the plane: on a flat surface 0 degrees is to the right; on a receding plane the
  // default (30) runs toward the viewer
  vec2 D = vec2(cos(radians(u_direction)), sin(radians(u_direction)));
  vec2 toward = rot(radians(u_direction - 30.)) * vec2(0., -1.);
  if (proj == 0 || proj == 7) {
    vec2 q = proj == 7 ? vec2(uv.x * .57735027 + uv.y, -uv.x * .57735027 + uv.y) : uv;
    p = rot(radians(u_rotation)) * q * S;
    rd = normalize(vec3(uv * .7, -1.));
    if (drift) p += D * t * .41;
    if (gMotion == 8) p += 2.5 * vec2(cos(t * .2), sin(t * .2));
  } else {
    // a camera over the plane, in the corridor, the tunnel, the dome, or before the ball, the column, the cube
    float k = S * .25;
    float yaw = gMotion == 8 ? sin(t * .25) * .45 : 0.;
    float pitch = 0., fl = 1.1;
    vec3 ro = vec3(0.);
    bool spin = drift || gMotion == 5;
    if (proj == 1) { pitch = .7 + .5 * u_tilt; ro.y = 1.6; }
    else if (proj == 2) { pitch = .06 + .3 * u_tilt; ro.y = 1.; }
    else if (proj == 8) { pitch = -.06 - .3 * u_tilt; ro.y = -1.; }
    else if (proj == 3) { yaw += .3 + .5 * u_tilt; }
    else if (proj == 9) { pitch = .05 + .12 * u_tilt; ro.y = -.2; }
    else if (proj == 6 || proj == 10) { ro.z = 3.2; fl = 1.7; }
    else if (proj == 11) { pitch = -1.15 + .5 * u_tilt; fl = .8; }
    else if (proj == 12) { ro.z = 4.6; fl = 1.9; }
    if (drift && (proj == 4 || proj == 5 || proj == 9)) ro.z -= t * .9 / k;
    fw = vec3(sin(yaw) * cos(pitch), -sin(pitch), -cos(yaw) * cos(pitch));
    rt = normalize(vec3(cos(yaw), 0., sin(yaw)));
    up = cross(rt, fw);
    rd = normalize(uv.x * rt + uv.y * up + fl * fw);
    float tt = 400.;
    vec3 h;
    if (proj == 1 || proj == 2 || proj == 8) {
      // a floor (a ceiling): the plane at y = 0 (y = 0 from below); beyond the horizon the sky
      float dir = proj == 8 ? 1. : -1.;
      sky = rd.y * dir > 1e-4 ? 0. : 1.;
      tt = min(rd.y * dir > 1e-4 ? -ro.y / rd.y : 400., 400.);
      h = ro + rd * tt;
      p = rot(radians(u_rotation)) * h.xz * k;
      if (drift) p += toward * t * .9;
      N = vec3(0., -dir, 0.); T = vec3(1., 0., 0.); B = vec3(0., 0., 1.);
    } else if (proj == 3) {
      sky = rd.z < -1e-4 ? 0. : 1.;
      tt = min(rd.z < -1e-4 ? (-2.2 - ro.z) / rd.z : 400., 400.);
      h = ro + rd * tt;
      p = rot(radians(u_rotation)) * h.xy * k * 1.6;
      if (drift) p += rot(radians(u_direction - 30.)) * vec2(1., 0.) * t * .9;
      N = vec3(0., 0., 1.); T = vec3(1., 0., 0.); B = vec3(0., 1., 0.);
    } else if (proj == 4) {
      // a square corridor: walls, floor and ceiling one unit away
      float tx = abs(rd.x) > 1e-4 ? (sign(rd.x) - ro.x) / rd.x : 400.;
      float ty = abs(rd.y) > 1e-4 ? (sign(rd.y) - ro.y) / rd.y : 400.;
      tt = min(min(tx, ty), 400.);
      h = ro + rd * tt;
      if (tx < ty) { p = vec2(h.z, h.y) * k * 2.; N = vec3(-sign(rd.x), 0., 0.); T = vec3(0., 0., 1.); B = vec3(0., 1., 0.); }
      else { p = vec2(h.x, h.z) * k * 2.; N = vec3(0., -sign(rd.y), 0.); T = vec3(1., 0., 0.); B = vec3(0., 0., 1.); }
    } else if (proj == 9) {
      // a hallway: a floor and two walls, open to the sky above them
      float tf = rd.y < -1e-4 ? (-1. - ro.y) / rd.y : 400.;
      float tw = abs(rd.x) > 1e-4 ? (sign(rd.x) * 1.6 - ro.x) / rd.x : 400.;
      bool wall = tw < tf && ro.y + rd.y * tw < 1.4;
      tt = min(wall ? tw : tf, 400.);
      sky = !wall && tf >= 400. ? 1. : 0.;
      h = ro + rd * tt;
      if (wall) { p = vec2(h.z, h.y) * k * 2.; N = vec3(-sign(rd.x), 0., 0.); T = vec3(0., 0., 1.); B = vec3(0., 1., 0.); }
      else { p = vec2(h.x, h.z) * k * 2.; N = vec3(0., 1., 0.); T = vec3(1., 0., 0.); B = vec3(0., 0., 1.); }
    } else if (proj == 5) {
      gPer = 6. * max(1., floor(S * .5 + .5));
      tt = min(1. / max(length(rd.xy), 1e-4), 400.);
      h = ro + rd * tt;
      float ang = atan(h.y, h.x);
      p = vec2(ang / TAU * gPer, h.z * gPer / TAU);
      N = -normalize(vec3(h.xy, 0.)); T = vec3(-sin(ang), cos(ang), 0.); B = vec3(0., 0., 1.);
    } else if (proj == 10) {
      // a column, turning: the pattern wraps around it
      gPer = 6. * max(1., floor(S * .5 + .5));
      float a = dot(rd.xz, rd.xz), b = dot(ro.xz, rd.xz), c = dot(ro.xz, ro.xz) - 1., disc = b * b - a * c;
      sky = disc > 0. ? 0. : 1.;
      tt = disc > 0. ? (-b - sqrt(max(disc, 0.))) / max(a, 1e-5) : 3.;
      h = ro + rd * tt;
      float ang = atan(h.z, h.x) + (spin ? t * .2 : 0.);
      p = vec2(ang / TAU * gPer, h.y * gPer / TAU);
      N = normalize(vec3(h.x, 0., h.z)); T = vec3(-N.z, 0., N.x); B = vec3(0., 1., 0.);
    } else if (proj == 11) {
      // a dome overhead: the inside of a ball, seen from its center
      gPer = 6. * max(1., floor(S * .5 + .5));
      h = rd;
      tt = 1.;
      float az = atan(h.z, h.x) + (spin ? t * .05 : 0.);
      p = vec2(az / TAU * gPer, acos(clamp(h.y, -1., 1.)) / PI * gPer * .5);
      N = -h; T = normalize(vec3(-h.z, 0., h.x) + vec3(1e-5, 0., 0.)); B = cross(N, T);
    } else if (proj == 12) {
      // a cube, turning: the pattern on each face
      float a = spin ? t * .25 : .6;
      mat2 ry = rot(a), rx = rot(.42);
      vec3 o = ro, d = rd;
      o.yz = rx * o.yz; d.yz = rx * d.yz;
      o.xz = ry * o.xz; d.xz = ry * d.xz;
      vec3 inv = 1. / (d + vec3(1e-6));
      vec3 t0 = (-1. - o) * inv, t1 = (1. - o) * inv;
      vec3 tn = min(t0, t1), tf = max(t0, t1);
      float tin = max(max(tn.x, tn.y), tn.z), tout = min(min(tf.x, tf.y), tf.z);
      sky = tin < tout && tin > 0. ? 0. : 1.;
      tt = sky > .5 ? 3. : tin;
      vec3 q = o + d * tt;
      vec3 aq = abs(q);
      float kf = max(1., floor(S * .25 + .5));
      vec3 nl = aq.x > aq.y && aq.x > aq.z ? vec3(sign(q.x), 0., 0.) : aq.y > aq.z ? vec3(0., sign(q.y), 0.) : vec3(0., 0., sign(q.z));
      p = (nl.x != 0. ? q.zy : nl.y != 0. ? q.xz : q.xy) * kf;
      vec3 tl = nl.x != 0. ? vec3(0., 0., 1.) : vec3(1., 0., 0.);
      vec3 bl = nl.y != 0. ? vec3(0., 0., 1.) : vec3(0., 1., 0.);
      // back to the camera's frame: undo the turns
      mat2 iy = rot(-a), ix = rot(-.42);
      nl.xz = iy * nl.xz; nl.yz = ix * nl.yz;
      tl.xz = iy * tl.xz; tl.yz = ix * tl.yz;
      bl.xz = iy * bl.xz; bl.yz = ix * bl.yz;
      N = nl; T = tl; B = bl;
      h = ro + rd * tt;
    } else {
      gPer = 6. * max(1., floor(S * .5 + .5));
      float b = dot(ro, rd), c = dot(ro, ro) - 1., disc = b * b - c;
      sky = disc > 0. ? 0. : 1.;
      tt = disc > 0. ? -b - sqrt(max(disc, 0.)) : 3.;
      h = ro + rd * tt;
      vec3 s = normalize(h);
      if (spin) s.xz = rot(t * .2) * s.xz;
      p = vec2(atan(s.z, s.x) / TAU * gPer, acos(clamp(s.y, -1., 1.)) / PI * gPer * .5);
      N = normalize(h); T = normalize(vec3(-h.z, 0., h.x) + vec3(1e-5, 0., 0.)); B = cross(N, T);
    }
    if (proj == 4 || proj == 9) p = rot(radians(u_rotation)) * p;
    dist = tt;
  }
  // the motions that move the pattern in its plane
  vec2 rip = vec2(0.);
  if (gMotion == 5 && proj != 6 && proj != 10 && proj != 12) p = proj == 5 || proj == 11 ? p + vec2(t * .4, 0.) : rot(t * .08) * p;
  if (gMotion == 6) p += .3 * vec2(sin(p.y * .45 + t * .9), cos(p.x * .45 + t * .7));
  if (gMotion == 9) p *= exp(-.55 * sin(t * .3));
  if (gMotion == 10) p = rot(t * .25 + length(p) * .04) * p;
  if (gMotion == 11) { float w = p.x * .45 + t * 2.; p.y += .45 * sin(w); rip = vec2(-.8 * cos(w), 0.); }
  if (gMotion == 12) p *= 1. + .06 * sin(t * 1.3);
  if (gMotion == 13) p = rot(2.2 * exp(-length(p) * .12) * sin(t * .45)) * p;
  if (gMotion == 17) { vec2 c = floor(p) + .5; p = c + rot(t * .9 + hash12(c) * TAU) * (p - c); }
  if (gMotion == 20) {
    float g = floor(t * 7.), band = floor(v_uv.y * 18.);
    p.x += step(.7, hash12(vec2(band, g))) * step(.5, hash12(vec2(g, 3.))) * (hash12(vec2(band, g + 1.)) - .5) * 3.;
  }
  if (gMotion == 23) p += (hash22(vec2(floor(t * 14.), 1.)) - .5) * .35 * step(.75, hash12(vec2(floor(t * 1.2), 9.)));
  if (gMotion == 4) {
    vec2 c = u_hover > .01 && proj == 0 ? ptr * S : vec2(0.);
    vec2 dp = p - c;
    float r = length(dp) + 1e-4;
    float w = cos(r * 1.6 - t * 3.) * exp(-r * .12);
    rip = dp / r * w;
    p += rip * .1;
  }
  // how many tiles one pixel covers: past a tile or so the pattern is only its average - computed before any
  // branch, so the derivatives stay defined
  vec2 fwv = fwidth(p);
  if (gPer > 0.) fwv.x = min(fwv.x, fwidth(mod(p.x, gPer)));
  float fwp = length(fwv);
  float lod = smoothstep(.18, .75, fwp);
  // the light: from u_light degrees around the view (135 = upper left), u_elevation above the surface; the pointer moves it
  float el = radians(clamp(u_elevation, 1., 89.));
  vec2 lp = vec2(cos(radians(u_light)), sin(radians(u_light))) * cos(el);
  if (u_hover > .01) lp = mix(lp, ptr * 1.8, u_hover);
  gLd = normalize(rt * lp.x + up * lp.y - fw * sin(el) * 1.2);
  gV = -rd;
  gUp = up;
  vec3 c0 = color(0);
  bool line = isLine(pid);
  // the far color: the material over a flat tile, outside and inside the shape, mixed by the pattern's cover
  vec3 sAvg = mixOk(color(1), color(2), .3);
  vec3 avg = mix(shade(mat, 0., .06, .05, vec3(0., 0., 1.), N, sAvg, 1., p, vec2(0.), 0., line, 0.),
    shade(mat, 1., -.06, .05, vec3(0., 0., 1.), N, sAvg, 1., p, vec2(0.), 0., line, 0.), COVER[pid]);
  vec3 col = avg;
  float rain = 1., head = 0., bright = 1.;
  if (lod < 1.) {
    vec4 P = pattern(p, pid);
    vec2 cell = P.zw;
    float cls = P.y;
    float pulse = gMotion == 2 ? .055 * sin(t * 2.4 - length(p) * .45) : 0.;
    if (gMotion == 15) {
      // cascade: the cells rise and sink in a diagonal wave
      float lift = .5 + .5 * sin(t * 2. - (cell.x + cell.y) * .35);
      pulse += (1. - lift) * .07;
      bright = .75 + .35 * lift;
    }
    if (gMotion == 16) {
      // flip: every cell turns over now and then, showing its other color
      float ph = t * .2 + crand(cell, 51.);
      float a = smoothstep(.75, 1., fract(ph)) * PI;
      cls = mod(cls + floor(ph) + step(PI * .5, a), 2.);
      bright = .35 + .65 * abs(cos(a));
    }
    if (gMotion == 22) {
      // domino: the cells change color in a wave that runs across the plane
      float w = t * .25 - (cell.x * .08 + cell.y * .05);
      cls = mod(cls + floor(w), 2.);
      bright = 1. + .35 * (1. - smoothstep(0., .12, fract(w)));
    }
    float d = P.x + pulse;
    float aa = max(fwp * .7, 1e-4);
    float m = 1. - smoothstep(-aa, aa, d);
    float bev = max(u_bevel, .02) * .14;
    vec3 nl = vec3(0., 0., 1.);
    if (mat != 1 && mat != 3 && mat != 26 && fwp < .9) {
      float e = max(.012, fwp * .5);
      float h0 = relief(d, bev, mat);
      float hx = relief(pattern(p + vec2(e, 0.), pid).x + pulse, bev, mat);
      float hy = relief(pattern(p + vec2(0., e), pid).x + pulse, bev, mat);
      float slope = bev * u_depth * 1.1;
      vec2 g = vec2(hx - h0, hy - h0) / e * slope;
      // a gem's facets: the slope in steps
      if (mat == 21) g = floor(g * 2.5 + .5) / 2.5;
      nl = normalize(vec3(-g.x - rip.x * .5, -g.y - rip.y * .5, 1.));
    }
    vec3 Nw = normalize(T * nl.x + B * nl.y + N * nl.z);
    int ci = int(cls + .5);
    vec3 sc = color(1 + ci);
    if (gMotion == 19) sc = rampCycle(cls * .33 + t * .06 + crand(cell, 61.) * u_variation);
    vec3 lab = toOklab(sc);
    lab.x += (crand(cell, 21.) - .5) * u_variation * .3;
    sc = fromOklab(lab);
    float face = pid == 13 ? (ci == 0 ? 1. : ci == 1 ? .74 : .52) : 1.;
    float shine = gMotion == 3 ? exp(-pow((dot(p, vec2(.8, .6)) - mod(t * 4., 60.) + 30.) * .35, 2.)) : 0.;
    if (gMotion == 14) {
      // rain: each column a falling head, a fading trail behind it - with the glyphs, digital rain
      float column = floor(p.x);
      float sp = .6 + hash12(vec2(column, 3.)) * 1.2;
      float ph = fract(hash12(vec2(column, 1.)) - (p.y + t * sp * 2.2) / 26.);
      rain = .12 + pow(ph, 5.) * 1.4;
      head = smoothstep(.965, 1., ph);
    }
    vec3 detail = shade(mat, m, d, aa, nl, Nw, sc, face, p, cell, shine, line, 1.) * bright;
    if (gMotion == 14) detail = detail * rain + mix(sc, vec3(1.), .7) * head * m * 1.4;
    if (gMotion == 18) {
      vec2 g = floor(p * 2.), f = fract(p * 2.) - .5;
      float on = step(.93, hash12(g + floor(t * 3. + hash12(g) * 3.)));
      float star = exp(-abs(f.x) * 40.) * exp(-abs(f.y) * 7.) + exp(-abs(f.y) * 40.) * exp(-abs(f.x) * 7.);
      detail += on * star * (.5 + .5 * sin(t * 9. + hash12(g) * 20.)) * 1.2;
    }
    col = mix(detail, avg * (gMotion == 14 ? .35 : 1.), lod);
  } else if (gMotion == 14) col *= .35;
  if (gMotion == 21) {
    // scan: a bright line runs down the picture, a glow fading behind it
    float y = 1. - fract(t * .2);
    col *= .82 + .3 * exp(-max(v_uv.y - y, 0.) * 7.) * step(y, v_uv.y + .001);
    col += mixOk(color(1), vec3(1.), .5) * exp(-pow((v_uv.y - y) * 60., 2.)) * .6;
  }
  // distance: a fog toward the horizon color; the sky starts from the same color, so the horizon is seamless
  bool dark = isDark(mat);
  vec3 fogCol = dark ? mix(c0 * .07, color(1), .16) : mixOk(c0, vec3(1.), .18);
  bool plane = proj == 1 || proj == 2 || proj == 3 || proj == 8 || proj == 9;
  if (proj != 0 && proj != 7 && proj != 6 && proj != 10 && proj != 12) {
    float fog = 1. - exp(-dist * u_fog * .03);
    // a haze along the horizon line itself, whatever the fog
    float haze = proj == 1 || proj == 2 || proj == 8 ? exp(-abs(rd.y) * 22.) * .85 : proj == 3 ? exp(-abs(rd.z) * 22.) * .85 : 0.;
    // a dark material's far field is mostly its dark ground: where the pattern is gone it sinks into the fog
    if (dark) haze = max(haze, lod * .75);
    col = mix(col, fogCol, max(fog, haze));
  }
  vec3 skyTop = dark ? c0 * .03 : mixOk(c0, color(1), .12);
  vec3 skyCol = proj == 6 || proj == 10 || proj == 12
    ? c0 * (.92 - .25 * length(uv))
    : mix(fogCol, skyTop, smoothstep(0., .5, proj == 8 ? -rd.y : proj == 3 ? rd.z : rd.y));
  col = mix(col, skyCol, sky);
  // a dark scene's horizon glows - on both sides of the line, so the floor brightens into it with no edge
  if (dark && plane) col += color(1) * exp(-abs(proj == 8 ? -rd.y : proj == 3 ? rd.z : rd.y) * 38.) * .7;
  // where the detail is finer than a pixel, the engine may blend in the last frame (data-smooth): the alpha says how much
  float hint = sky > .5 ? 0. : smoothstep(.15, .7, fwp);
  fragColor = vec4(dither(col), u_temporal > .5 ? hint : 1.);
}`}},yf={colors:ze,background:"var(--background)",still:0},hi={advect:`uniform sampler2D u_velocity, u_source; uniform vec2 u_texel; uniform float u_dt, u_dissipation;
void main() { vec2 coord = v_uv - u_dt * texture(u_velocity, v_uv).xy * u_texel; fragColor = texture(u_source, coord) / (1. + u_dissipation * u_dt); }`,divergence:`uniform sampler2D u_velocity; uniform vec2 u_texel;
void main() {
  vec2 C = texture(u_velocity, v_uv).xy;
  float L = texture(u_velocity, v_uv - vec2(u_texel.x, 0.)).x, R = texture(u_velocity, v_uv + vec2(u_texel.x, 0.)).x;
  float B = texture(u_velocity, v_uv - vec2(0., u_texel.y)).y, T = texture(u_velocity, v_uv + vec2(0., u_texel.y)).y;
  if (v_uv.x - u_texel.x < 0.) L = -C.x;
  if (v_uv.x + u_texel.x > 1.) R = -C.x;
  if (v_uv.y - u_texel.y < 0.) B = -C.y;
  if (v_uv.y + u_texel.y > 1.) T = -C.y;
  fragColor = vec4(.5 * (R - L + T - B), 0., 0., 1.);
}`,curl:`uniform sampler2D u_velocity; uniform vec2 u_texel;
void main() {
  float L = texture(u_velocity, v_uv - vec2(u_texel.x, 0.)).y, R = texture(u_velocity, v_uv + vec2(u_texel.x, 0.)).y;
  float B = texture(u_velocity, v_uv - vec2(0., u_texel.y)).x, T = texture(u_velocity, v_uv + vec2(0., u_texel.y)).x;
  fragColor = vec4(.5 * (R - L - T + B), 0., 0., 1.);
}`,vorticity:`uniform sampler2D u_velocity, u_curl; uniform vec2 u_texel; uniform float u_strength, u_dt;
void main() {
  float L = texture(u_curl, v_uv - vec2(u_texel.x, 0.)).x, R = texture(u_curl, v_uv + vec2(u_texel.x, 0.)).x;
  float B = texture(u_curl, v_uv - vec2(0., u_texel.y)).x, T = texture(u_curl, v_uv + vec2(0., u_texel.y)).x;
  float C = texture(u_curl, v_uv).x;
  vec2 force = .5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
  force = force / (length(force) + .0001) * u_strength * C * vec2(1., -1.);
  fragColor = vec4(clamp(texture(u_velocity, v_uv).xy + force * u_dt, -1000., 1000.), 0., 1.);
}`,pressure:`uniform sampler2D u_pressure, u_divergence; uniform vec2 u_texel;
void main() {
  float L = texture(u_pressure, v_uv - vec2(u_texel.x, 0.)).x, R = texture(u_pressure, v_uv + vec2(u_texel.x, 0.)).x;
  float B = texture(u_pressure, v_uv - vec2(0., u_texel.y)).x, T = texture(u_pressure, v_uv + vec2(0., u_texel.y)).x;
  fragColor = vec4((L + R + B + T - texture(u_divergence, v_uv).x) * .25, 0., 0., 1.);
}`,gradient:`uniform sampler2D u_pressure, u_velocity; uniform vec2 u_texel;
void main() {
  float L = texture(u_pressure, v_uv - vec2(u_texel.x, 0.)).x, R = texture(u_pressure, v_uv + vec2(u_texel.x, 0.)).x;
  float B = texture(u_pressure, v_uv - vec2(0., u_texel.y)).x, T = texture(u_pressure, v_uv + vec2(0., u_texel.y)).x;
  fragColor = vec4(texture(u_velocity, v_uv).xy - .5 * vec2(R - L, T - B), 0., 1.);
}`,splat:`uniform sampler2D u_target; uniform vec2 u_point; uniform vec3 u_value; uniform float u_radius;
void main() {
  vec2 d = (v_uv - u_point) * vec2(aspect(), 1.);
  fragColor = vec4(texture(u_target, v_uv).xyz + exp(-dot(d, d) / u_radius) * u_value, 1.);
}`,scale:`uniform sampler2D u_target; uniform float u_value;
void main() { fragColor = u_value * texture(u_target, v_uv); }`,fluid:`uniform sampler2D u_dye; uniform vec2 u_texel; uniform float u_shading;
void main() {
  vec3 c = texture(u_dye, v_uv).rgb;
  float l = length(texture(u_dye, v_uv - vec2(u_texel.x, 0.)).rgb), r = length(texture(u_dye, v_uv + vec2(u_texel.x, 0.)).rgb);
  float b = length(texture(u_dye, v_uv - vec2(0., u_texel.y)).rgb), t = length(texture(u_dye, v_uv + vec2(0., u_texel.y)).rgb);
  vec3 n = normalize(vec3(l - r, b - t, .25));
  c *= mix(1., clamp(dot(n, normalize(vec3(-.3, .4, 1.))) + .25, .6, 1.15), u_shading);
  float a = clamp(max(c.r, max(c.g, c.b)), 0., 1.);
  fragColor = vec4(dither(c / max(a, .001)) * a, a) + backdrop() * (1. - a);
}`,trail:`uniform sampler2D u_prev; uniform vec2 u_a, u_b; uniform float u_brush, u_fade, u_flow, u_strength;
void main() {
  vec2 flow = (vec2(gnoise(v_uv * 4. + u_time * .3), gnoise(v_uv * 4. - u_time * .3 + 9.)) * .0016 + vec2(0., .0005)) * u_flow;
  vec3 prev = texture(u_prev, v_uv - flow).rgb * u_fade;
  vec2 k = vec2(aspect(), 1.), a = u_a * k, ab = u_b * k - a, x = v_uv * k;
  float h = clamp(dot(x - a, ab) / max(dot(ab, ab), 1e-6), 0., 1.);
  float r = u_brush * .065, d = length(x - a - ab * h);
  fragColor = vec4(prev + rampCycle(u_time * .22) * exp(-d * d / (r * r)) * u_strength, 1.);
}`,trails:`uniform sampler2D u_trail; uniform vec2 u_texel;
void main() {
  vec3 c = texture(u_trail, v_uv).rgb;
  vec3 halo = (texture(u_trail, v_uv + vec2(u_texel.x, 0.) * 3.).rgb + texture(u_trail, v_uv - vec2(u_texel.x, 0.) * 3.).rgb
    + texture(u_trail, v_uv + vec2(0., u_texel.y) * 3.).rgb + texture(u_trail, v_uv - vec2(0., u_texel.y) * 3.).rgb) * .25;
  c = c + halo * .35;
  c = 1. - exp(-c * 2.4);
  float a = clamp(max(c.r, max(c.g, c.b)), 0., 1.);
  fragColor = vec4(dither(c / max(a, .001)) * a, a) + backdrop() * (1. - a);
}`},gi={fxaa:`uniform sampler2D u_scene, u_history; uniform vec2 u_texel; uniform float u_fxaa, u_smooth, u_has_history;
vec4 fxaa(vec2 uv) {
  vec4 m = texture(u_scene, uv);
  vec3 lw = vec3(.299, .587, .114);
  float lNW = dot(texture(u_scene, uv + vec2(-1., 1.) * u_texel).rgb, lw);
  float lNE = dot(texture(u_scene, uv + vec2(1., 1.) * u_texel).rgb, lw);
  float lSW = dot(texture(u_scene, uv + vec2(-1., -1.) * u_texel).rgb, lw);
  float lSE = dot(texture(u_scene, uv + vec2(1., -1.) * u_texel).rgb, lw);
  float lM = dot(m.rgb, lw);
  float lMin = min(lM, min(min(lNW, lNE), min(lSW, lSE)));
  float lMax = max(lM, max(max(lNW, lNE), max(lSW, lSE)));
  if (lMax - lMin < max(.0312, lMax * .125)) return m;
  vec2 dir = vec2(-((lNW + lNE) - (lSW + lSE)), (lNW + lSW) - (lNE + lSE));
  float reduce = max((lNW + lNE + lSW + lSE) * .03125, 1. / 128.);
  dir = clamp(dir / (min(abs(dir.x), abs(dir.y)) + reduce), -8., 8.) * u_texel;
  vec4 a = .5 * (texture(u_scene, uv + dir * (1. / 3. - .5)) + texture(u_scene, uv + dir * (2. / 3. - .5)));
  vec4 b = a * .5 + .25 * (texture(u_scene, uv - dir * .5) + texture(u_scene, uv + dir * .5));
  float lB = dot(b.rgb, lw);
  return lB < lMin || lB > lMax ? a : b;
}
void main() {
  vec4 scene = texture(u_scene, v_uv);
  vec4 c = u_fxaa > .5 ? fxaa(v_uv) : scene;
  if (u_smooth > 0.) {
    float w = u_has_history * u_smooth * scene.a;
    c = vec4(mix(c.rgb, texture(u_history, v_uv).rgb, w), 1.);
  }
  fragColor = c;
}`,blit:`uniform sampler2D u_scene;
void main() { fragColor = texture(u_scene, v_uv); }`},k=globalThis.WebGL2RenderingContext,xf=new Set(["u_resolution","u_time","u_delta","u_pointer","u_hover","u_colors","u_color_count","u_background","u_image","u_has_image","u_seed","u_pixel_ratio","u_frame","u_taps","u_tap_count","u_temporal"]),b={gl:null,canvas:null,unsupported:!1,floatTargets:!1,vao:null,blank:null,programs:new Map,parallel:null,compileUntil:0,instances:new Set,raf:0,frames:0,scale:1,level:0,raisedAt:-1/0,held:!1,good:0,lastTick:0,window:0,windowStart:0,slow:0,idleSince:0,io:null,near:null,ro:null,controls:new Set},Xt=()=>!!globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches,te=(e,t)=>{let r=e==null||e===""?NaN:Number(e);return Number.isFinite(r)?r:t};function _f(){if(b.gl)return b.gl.isContextLost()?null:b.gl;if(b.unsupported)return null;let e=document.createElement("canvas"),t=e.getContext("webgl2",{alpha:!0,premultipliedAlpha:!0,antialias:!1,depth:!1,stencil:!1,preserveDrawingBuffer:!0});return t?(e.addEventListener("webglcontextlost",r=>{r.preventDefault(),Si()}),e.addEventListener("webglcontextrestored",()=>{vi(t);for(let r of b.instances)r.needsFrame=!0;tt()}),b.gl=t,b.canvas=e,vi(t),t):(b.unsupported=!0,null)}function vi(e){b.floatTargets=!!(e.getExtension("EXT_color_buffer_float")||e.getExtension("EXT_color_buffer_half_float")),b.parallel=e.getExtension("KHR_parallel_shader_compile");let t=e.createBuffer();e.bindBuffer(k.ARRAY_BUFFER,t),e.bufferData(k.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),k.STATIC_DRAW),b.vao=e.createVertexArray(),e.bindVertexArray(b.vao),e.enableVertexAttribArray(0),e.vertexAttribPointer(0,2,k.FLOAT,!1,0,0),b.blank=e.createTexture(),e.bindTexture(k.TEXTURE_2D,b.blank),e.texImage2D(k.TEXTURE_2D,0,k.RGBA,1,1,0,k.RGBA,k.UNSIGNED_BYTE,new Uint8Array(4))}function Si(){b.programs.clear(),b.vao=null;for(let e of b.instances)e.texture=null,e.sim=null,e.post=null,e.imageDirty=!0,e.prog=null,e.dirty=!0}function wf(){b.gl&&(b.gl.getExtension("WEBGL_lose_context")?.loseContext(),b.gl=null,b.canvas=null,Si())}function bi(e,t,r,o=!0){let a=e.createShader(t);if(e.shaderSource(a,r),e.compileShader(a),o&&!e.getShaderParameter(a,k.COMPILE_STATUS)){let n=e.getShaderInfoLog(a)||"compile error";throw e.deleteShader(a),new Error(n.trim())}return a}function Vt(e,t=!1){let r=b.gl,o=/^\s*#version/.test(e)?e:bf+e,a=b.programs.get(o);if(a)return a;let n=t&&!!b.parallel;if(t&&!n&&b.compileUntil&&performance.now()>b.compileUntil)return null;let i;try{let s=r.createProgram(),c=[bi(r,k.VERTEX_SHADER,vf,!n),bi(r,k.FRAGMENT_SHADER,o,!n)];for(let l of c)r.attachShader(s,l);r.bindAttribLocation(s,0,"a_position"),r.linkProgram(s),i={prog:s,shaders:c,uniforms:new Map,params:[],error:"",pending:!0},n||Mi(i)}catch(s){i={prog:null,uniforms:new Map,params:[],error:s instanceof Error?s.message:String(s)}}return b.programs.set(o,i),i}function Mi(e){let t=b.gl,r=e.prog;if(e.pending=!1,!t.getProgramParameter(r,k.LINK_STATUS)){let a=e.shaders.filter(n=>!t.getShaderParameter(n,k.COMPILE_STATUS)).map(n=>t.getShaderInfoLog(n)||"");e.error=(a.join(`
`).trim()||t.getProgramInfoLog(r)||"link error").trim(),e.prog=null;return}let o=t.getProgramParameter(r,k.ACTIVE_UNIFORMS);for(let a=0;a<o;a++){let n=t.getActiveUniform(r,a),i=n.name.replace(/\[0\]$/,"");e.uniforms.set(i,{loc:t.getUniformLocation(r,i),type:n.type,size:n.size}),!xf.has(i)&&n.type===k.FLOAT&&n.size===1&&i.startsWith("u_")&&e.params.push(i)}}function kf(e){return e?e.pending?b.gl.getProgramParameter(e.prog,b.parallel.COMPLETION_STATUS_KHR)?(Mi(e),!0):!1:!0:!1}function Af(e,t){let r=b.gl,o=0;for(let a in t){let n=e.uniforms.get(a);if(!n)continue;let i=t[a];i instanceof WebGLTexture?(r.activeTexture(k.TEXTURE0+o),r.bindTexture(k.TEXTURE_2D,i),r.uniform1i(n.loc,o++)):typeof i=="number"?n.type===k.INT||n.type===k.BOOL?r.uniform1i(n.loc,i):r.uniform1f(n.loc,i):n.type===k.FLOAT_VEC2?r.uniform2fv(n.loc,i):n.type===k.FLOAT_VEC3?r.uniform3fv(n.loc,i):n.type===k.FLOAT_VEC4&&r.uniform4fv(n.loc,i)}}function Ef(e,t,r){return{u_resolution:[t,r],u_time:e.time,u_delta:e.delta,u_pointer:e.pointer,u_hover:e.hover,u_colors:e.liveColors,u_color_count:e.colorCount,u_background:e.background,u_has_image:e.hasImage,u_seed:e.seed,u_pixel_ratio:e.scale,u_frame:[e.frame[0]*e.scale,e.frame[1]*e.scale],u_taps:e.tapData,u_tap_count:e.taps.length,u_temporal:e.temporalOn?1:0}}function R(e,t,r,o){let a=b.gl,n=r?r.w:e.w,i=r?r.h:e.h;a.bindFramebuffer(k.FRAMEBUFFER,r?r.fbo:null),a.viewport(0,0,n,i),a.useProgram(t.prog),a.bindVertexArray(b.vao),Af(t,{...Ef(e,n,i),u_image:e.texture||b.blank,...o}),a.drawArrays(k.TRIANGLES,0,3)}function et(e,t,r){let o=b.gl,a=o.createTexture();o.bindTexture(k.TEXTURE_2D,a),o.texParameteri(k.TEXTURE_2D,k.TEXTURE_MIN_FILTER,k.LINEAR),o.texParameteri(k.TEXTURE_2D,k.TEXTURE_MAG_FILTER,k.LINEAR),o.texParameteri(k.TEXTURE_2D,k.TEXTURE_WRAP_S,k.CLAMP_TO_EDGE),o.texParameteri(k.TEXTURE_2D,k.TEXTURE_WRAP_T,k.CLAMP_TO_EDGE),r?o.texImage2D(k.TEXTURE_2D,0,k.RGBA16F,e,t,0,k.RGBA,k.HALF_FLOAT,null):o.texImage2D(k.TEXTURE_2D,0,k.RGBA,e,t,0,k.RGBA,k.UNSIGNED_BYTE,null);let n=o.createFramebuffer();return o.bindFramebuffer(k.FRAMEBUFFER,n),o.framebufferTexture2D(k.FRAMEBUFFER,k.COLOR_ATTACHMENT0,k.TEXTURE_2D,a,0),o.viewport(0,0,e,t),o.clearColor(0,0,0,0),o.clear(k.COLOR_BUFFER_BIT),{tex:a,fbo:n,w:e,h:t}}function Ze(e,t,r){let o={read:et(e,t,r),write:et(e,t,r),swap(){}};return o.swap=()=>{let a=o.read;o.read=o.write,o.write=a},o}function rt(e){let t=b.gl,r=e.sim,o=e.post;if(e.sim=null,e.post=null,!!t)for(let a of[...r?.targets||[],...o?.targets||[]])t.deleteTexture(a.tex),t.deleteFramebuffer(a.fbo)}function Tf(e,t){let{w:r,h:o}=e,a=e.post;if(!a||a.w!==r||a.h!==o||!!a.history!==t){rt(e);let n=et(r,o,!1),i=t?Ze(r,o,!1):null;a=e.post={w:r,h:o,scene:n,history:i,fresh:!0,targets:[n,...i?[i.read,i.write]:[]]}}return a}function Sf(e,t){let r={fxaa:Vt(gi.fxaa),blit:Vt(gi.blit)},o=Object.values(r).find(s=>s.error);if(o)return we(e,o.error);let a=e.smooth>0&&!Xt();e.temporalOn=a;let n=Tf(e,a);R(e,e.prog,n.scene,t);let i={u_scene:n.scene.tex,u_history:n.history?n.history.read.tex:b.blank,u_texel:[1/e.w,1/e.h],u_fxaa:e.aa==="fxaa"?1:0,u_smooth:a?e.smooth:0,u_has_history:n.fresh?0:1};if(n.fresh=!1,!n.history)return R(e,r.fxaa,null,i);R(e,r.fxaa,n.history.write,i),R(e,r.blit,null,{u_scene:n.history.write.tex}),n.history.swap()}var Oi=()=>{let e={};for(let t in hi)e[t]=Vt(hi[t]);return e};function Le(e){return e.n=e.n*1664525+1013904223>>>0,e.n/4294967296}function yi(e,t,r){let o=t.colorIndex++%Math.max(e.colorCount,1)*3;return[e.colors[o]*r,e.colors[o+1]*r,e.colors[o+2]*r]}function Mf(e,t){if(!b.floatTargets)return we(e,"fluid needs float render targets (EXT_color_buffer_float)");let r=Oi(),o=Object.values(r).find(v=>v.error);if(o)return we(e,o.error);let a=e.quality==="low"?.6:e.quality==="high"?1.4:1,n=e.w/e.h,i=Math.round(128*a),s=Math.round(Math.min(512*a,Math.min(e.w,e.h))),c=v=>n>=1?[Math.round(v*n),v]:[v,Math.round(v/n)],[l,f]=c(i),[u,g]=c(s),d=e.sim;if(!d||d.kind!=="fluid"||d.sw!==l||d.dw!==u){rt(e);let v=Ze(l,f,!0),_=Ze(u,g,!0),w=Ze(l,f,!0),E=et(l,f,!0),M=et(l,f,!0);d=e.sim={kind:"fluid",sw:l,sh:f,dw:u,vel:v,dye:_,pressure:w,div:E,curl:M,targets:[v.read,v.write,_.read,_.write,w.read,w.write,E,M],n:e.seed*7919+17>>>0,colorIndex:0,nextAuto:0,warm:!1}}let p=[1/l,1/f],x=e.params,m=(v,_,w,E,M)=>{let D=Math.max(x.u_radius??.4,.01)/100;R(e,r.splat,d.vel.write,{u_target:d.vel.read.tex,u_point:[v,_],u_value:[w,E,0],u_radius:D}),d.vel.swap(),R(e,r.splat,d.dye.write,{u_target:d.dye.read.tex,u_point:[v,_],u_value:M,u_radius:D}),d.dye.swap()},h=v=>{for(let _=0;_<v;_++){let w=.15+Le(d)*.7,E=.15+Le(d)*.7;m(w,E,(Le(d)-.5)*2600,(Le(d)-.5)*2600,yi(e,d,2.2))}},y=v=>{R(e,r.curl,d.curl,{u_velocity:d.vel.read.tex,u_texel:p}),R(e,r.vorticity,d.vel.write,{u_velocity:d.vel.read.tex,u_curl:d.curl.tex,u_texel:p,u_strength:x.u_curl??22,u_dt:v}),d.vel.swap(),R(e,r.divergence,d.div,{u_velocity:d.vel.read.tex,u_texel:p}),R(e,r.scale,d.pressure.write,{u_target:d.pressure.read.tex,u_value:.8}),d.pressure.swap();for(let _=0;_<20;_++)R(e,r.pressure,d.pressure.write,{u_pressure:d.pressure.read.tex,u_divergence:d.div.tex,u_texel:p}),d.pressure.swap();R(e,r.gradient,d.vel.write,{u_pressure:d.pressure.read.tex,u_velocity:d.vel.read.tex,u_texel:p}),d.vel.swap(),R(e,r.advect,d.vel.write,{u_velocity:d.vel.read.tex,u_source:d.vel.read.tex,u_texel:p,u_dt:v,u_dissipation:.2}),d.vel.swap(),R(e,r.advect,d.dye.write,{u_velocity:d.vel.read.tex,u_source:d.dye.read.tex,u_texel:p,u_dt:v,u_dissipation:x.u_dissipation??.6}),d.dye.swap()};if(!d.warm){d.warm=!0,h(8);for(let v=0;v<60;v++)y(1/60)}for(let v of e.splats.splice(0))m(v.x,v.y,v.dx*5e3,v.dy*5e3,yi(e,d,.4));t>0&&(d.nextAuto-=t,d.nextAuto<=0&&e.hover<.5&&(h(1+Math.floor(Le(d)*2)),d.nextAuto=1.6+Le(d)*1.4),y(Math.min(t,1/30))),R(e,r.fluid,null,{u_dye:d.dye.read.tex,u_texel:[1/u,1/g],u_shading:x.u_shading??.6})}function Of(e,t){let r=Oi(),o=Object.values(r).find(f=>f.error);if(o)return we(e,o.error);let a=Math.max(1,Math.round(e.w/2)),n=Math.max(1,Math.round(e.h/2)),i=e.sim;if(!i||i.kind!=="trails"||i.w!==a||i.h!==n){rt(e);let f=Ze(a,n,b.floatTargets);i=e.sim={kind:"trails",w:a,h:n,trail:f,targets:[f.read,f.write],last:null,warm:!1,clock:0}}let s=e.params,c=f=>[.5+.34*Math.sin(f*1.3),.5+.3*Math.sin(f*1.9+1)],l=(f,u,g)=>{let d=Math.hypot(u[0]-f[0],u[1]-f[1]);R(e,r.trail,i.trail.write,{u_prev:i.trail.read.tex,u_a:f,u_b:u,u_brush:s.u_brush??1,u_fade:Math.pow(Math.min(s.u_decay??.965,.999),g*60),u_flow:s.u_flow??1,u_strength:Math.min(Math.max(d*40,.12),1.2)}),i.trail.swap()};if(!i.warm){i.warm=!0;let f=c(0);for(let u=1;u<=120;u++){let g=c(u/60);l(f,g,1/60),f=g}i.clock=2,i.last=f}if(t>0||e.hover>.01){let f=Math.max(t,.008333333333333333);i.clock+=t;let u=e.hover>.5?[...e.pointer]:c(i.clock);l(i.last??u,u,f),i.last=u}R(e,r.trails,null,{u_trail:i.trail.read.tex,u_texel:[1/a,1/n]})}var Ht={fluid:Mf,trails:Of};function Cf(e){let t=Array.from(e.children).find(r=>r instanceof HTMLScriptElement&&/x-shader\/x-fragment/i.test(r.type));return t&&t.textContent||""}function Nf(e){return Array.from(e.children).find(t=>(t instanceof HTMLImageElement||t instanceof HTMLVideoElement||t instanceof SVGSVGElement||t instanceof HTMLCanvasElement)&&!t.classList.contains("shader-canvas"))||null}function $f(e){let t=[],r=0,o="";for(let a of e)a==="("&&r++,a===")"&&r--,r===0&&(a===","||/\s/.test(a))?(o&&t.push(o),o=""):o+=a;return o&&t.push(o),t}var go=null;function Lf(e){if(!go){let o=document.createElement("canvas");o.width=o.height=1,go=o.getContext("2d",{willReadFrequently:!0})}let t=go;t.clearRect(0,0,1,1),t.fillStyle="#000",t.fillStyle=e,t.fillRect(0,0,1,1);let r=t.getImageData(0,0,1,1).data;return[r[0]/255,r[1]/255,r[2]/255,r[3]/255]}function _o(e){e.colorsDirty=!1;let t=e.el,r=e.def,o=t.dataset.colors?$f(t.dataset.colors):r.colors||ze,a=document.createElement("span");a.className="shader-probe",a.style.display="none",t.append(a);let n=s=>(a.style.color="",a.style.color=s,a.style.color?Lf(getComputedStyle(a).color):null),i=o.map(n).filter(Boolean).slice(0,8);r.sortColors&&i.sort((s,c)=>s[0]*.2126+s[1]*.7152+s[2]*.0722-(c[0]*.2126+c[1]*.7152+c[2]*.0722)),e.colors=new Float32Array(24),i.forEach((s,c)=>e.colors.set(s.slice(0,3),c*3)),e.colorCount=i.length,e.background=n(t.dataset.background??r.background??"transparent")||[0,0,0,0],a.remove()}function Ci(e){let t=e.el;if(e.variant==="border"){let r=t.parentElement,o=-parseFloat(getComputedStyle(t).top)||0;e.frame=[Math.max(o,0),r&&parseFloat(getComputedStyle(r).borderTopLeftRadius)||0]}else e.frame=[Math.min(e.cssW,e.cssH)*.1,14]}function yo(e){let t=e.el,r=t.dataset,o=Cf(t),a=r.effect||(o?"custom":"mesh-gradient"),n=a==="custom"?o?{...yf,fragment:o}:null:Ut[a],i=n&&!Ht[a]?Vt(n.fragment,!0):null;if(n&&!Ht[a]&&!kf(i))return;if(e.dirty=!1,!n)return we(e,a==="custom"?'a custom shader needs a <script type="x-shader/x-fragment"> child':`unknown effect "${a}"`);let s=e.effect!==a||e.def?.fragment!==n.fragment;if(s&&(rt(e),e.colorsDirty=!0,e.imageDirty=!0,e.snap=!0),e.effect=a,e.def=n,e.timeSet||(e.time=te(r.time,n.still??0),e.timeSet=!0),e.speed=Math.max(te(r.speed,1),0),e.fps=Math.max(te(r.fps,0),0),e.quality=r.quality||"auto",e.variant=r.variant||"",e.interactive=r.interactive!==void 0?r.interactive!=="false":!!n.interactive,e.seed=Math.max(Math.round(te(r.seed,0)),0),e.aa=r.aa||n.aa||"none",e.smooth=Math.min(Math.max(te(r.smooth,n.temporal??0),0),.95),e.source=Nf(t),Ci(e),e.colorsDirty&&_o(e),e.prog=i,e.prog?.error)return we(e,e.prog.error);let c=e.prog?e.prog.params:Object.keys(n.params||{}).map(l=>`u_${l}`);e.params={};for(let l of c){let f=l.slice(2);e.params[l]=te(t.getAttribute(`data-${f.replace(/_/g,"-")}`),n.params?.[f]??0)}for(let l in n.options||{}){let f=n.options[l].indexOf(t.getAttribute(`data-${l.replace(/_/g,"-")}`)||"");e.params[`u_${l}`]=Math.max(f,0)}e.error&&(e.error="",delete t.dataset.fallback),Bt(e,s)}function we(e,t){e.error!==t&&(e.error=t,e.el.dataset.fallback="",e.el.dispatchEvent(new CustomEvent("shader-error",{bubbles:!0,detail:{effect:e.effect||e.el.dataset.effect||"",message:t}})))}function zf(e){let t=globalThis.devicePixelRatio||1,r;if(e.quality==="low")r=Math.min(t,1)*.5;else if(e.quality==="high")r=Math.min(t,2);else{r=Math.min(t,1.5)*b.scale;let o=22e5,a=e.cssW*e.cssH*r*r;a>o&&(r*=Math.sqrt(o/a))}r*=e.def?.cost??1,e.scale=r,e.w=Math.max(1,Math.round(e.cssW*r)),e.h=Math.max(1,Math.round(e.cssH*r))}function Rf(e){let t=b.gl;e.imageDirty=!1,e.hasImage=0;let r=e.source;if(!r||!e.def?.image)return;let o=r,a=0,n=0;if(r instanceof HTMLImageElement){if(!r.complete||!r.naturalWidth){r.addEventListener("load",()=>H(e,!0),{once:!0});return}a=r.naturalWidth,n=r.naturalHeight}else if(r instanceof HTMLVideoElement){if(r.readyState<2){r.addEventListener("loadeddata",()=>H(e,!0),{once:!0});return}a=r.videoWidth,n=r.videoHeight}else if(r instanceof HTMLCanvasElement)a=r.width,n=r.height;else{let g=`${e.w}x${e.h}`,d=new XMLSerializer().serializeToString(r);if(e.svgImage?.key!==g||e.svgImage.markup!==d){let p=r.cloneNode(!0);p.setAttribute("xmlns","http://www.w3.org/2000/svg"),p.setAttribute("width",String(e.w)),p.setAttribute("height",String(e.h)),p.style.color=getComputedStyle(r).color;let x=new Image;e.svgImage={key:g,markup:d,img:x,ready:!1},x.onload=()=>{e.svgImage?.img===x&&(e.svgImage.ready=!0,H(e,!0))},x.src=`data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(p))}`;return}if(!e.svgImage.ready)return;o=e.svgImage.img,a=e.w,n=e.h}if(!a||!n)return;let i=e.el.dataset.fit||(e.def.image==="mask"?"contain":"cover"),s=e.imageCanvas??=document.createElement("canvas");s.width=e.w,s.height=e.h;let c=s.getContext("2d");c.clearRect(0,0,e.w,e.h);let l=i==="fill"?0:i==="cover"?Math.max(e.w/a,e.h/n):Math.min(e.w/a,e.h/n),f=l?a*l:e.w,u=l?n*l:e.h;try{c.drawImage(o,(e.w-f)/2,(e.h-u)/2,f,u),e.texture||(e.texture=t.createTexture(),t.bindTexture(k.TEXTURE_2D,e.texture),t.texParameteri(k.TEXTURE_2D,k.TEXTURE_MIN_FILTER,k.LINEAR),t.texParameteri(k.TEXTURE_2D,k.TEXTURE_WRAP_S,k.CLAMP_TO_EDGE),t.texParameteri(k.TEXTURE_2D,k.TEXTURE_WRAP_T,k.CLAMP_TO_EDGE)),t.bindTexture(k.TEXTURE_2D,e.texture),t.pixelStorei(k.UNPACK_FLIP_Y_WEBGL,!0),t.pixelStorei(k.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!1),t.texImage2D(k.TEXTURE_2D,0,k.RGBA,k.RGBA,k.UNSIGNED_BYTE,s),t.pixelStorei(k.UNPACK_FLIP_Y_WEBGL,!1),e.hasImage=1,delete e.el.dataset.image}catch{e.el.dataset.image="blocked"}r instanceof HTMLVideoElement&&!r.paused&&(e.imageDirty=!0)}function Df(e,t){if(e.dirty&&yo(e),e.error||!e.def||!e.prog&&!Ht[e.effect]||!e.cssW||!e.cssH)return;e.colorsDirty&&_o(e);let r=`${e.w}x${e.h}`;zf(e),`${e.w}x${e.h}`!==r&&(e.imageDirty=!0);let{w:o,h:a}=e;(e.canvas.width!==o||e.canvas.height!==a)&&(e.canvas.width=o,e.canvas.height=a);let n=b.canvas;(n.width<o||n.height<a)&&(n.width=Math.max(n.width,o),n.height=Math.max(n.height,a)),e.imageDirty&&Rf(e),e.delta=t;let i=Ht[e.effect];if(e.temporalOn=!1,i?i(e,t):e.aa==="fxaa"||e.smooth>0?Sf(e,e.live):R(e,e.prog,null,e.live),!e.error){e.ctx.clearRect(0,0,o,a),e.ctx.drawImage(n,0,n.height-a,o,a,0,0,o,a),e.frames++,b.frames++;for(let s of e.waiters.splice(0))s();e.ready||(e.ready=!0,e.el.dataset.ready="",e.el.dispatchEvent(new CustomEvent("shader-ready",{bubbles:!0,detail:{effect:e.effect,width:o,height:a,pixelRatio:e.scale}})))}}function If(e,t){let r=e.snap||Xt()||!e.live;e.snap=!1;let o=r?1:1-Math.exp(-t*12),a=e.live??={},n=e.def?.options||{},i=!1;for(let c in e.params){let l=e.params[c],f=c.slice(2)in n;f&&a[c]!==l&&e.post&&(e.post.fresh=!0),!(c in a)||f?a[c]=l:a[c]+=(l-a[c])*o,Math.abs(l-a[c])>Math.abs(l)*1e-4+1e-5?i=!0:a[c]=l}for(let c in a)c in e.params||delete a[c];let s=e.liveColors??=new Float32Array(24);if(r||e.colorsSnap)s.set(e.colors);else for(let c=0;c<24;c++)s[c]+=(e.colors[c]-s[c])*o,Math.abs(e.colors[c]-s[c])>.001?i=!0:s[c]=e.colors[c];return e.colorsSnap=!1,i}function Ff(e,t){let r=1-Math.exp(-t*10),o=e.pointer,a=e.pointerTarget;return o[0]+=(a[0]-o[0])*r,o[1]+=(a[1]-o[1])*r,e.hover+=(e.hoverTarget-e.hover)*r,Math.abs(a[0]-o[0])+Math.abs(a[1]-o[1])+Math.abs(e.hoverTarget-e.hover)>5e-4}function jf(e){return e.easing||Math.abs(e.pointerTarget[0]-e.pointer[0])+Math.abs(e.pointerTarget[1]-e.pointer[1])+Math.abs(e.hoverTarget-e.hover)>5e-4}var xi=[1,.75,.5],qf=120,Pf=2e3,Uf=2e4;function Bf(e){let t=b.lastTick?e-b.lastTick:16;if(b.lastTick=e,t>=1e3||(b.window||(b.windowStart=e),b.window++,t>30&&b.slow++,b.window<8||b.window<qf&&e-b.windowStart<Pf))return;let r=b.slow/b.window;b.window=b.slow=0,r>=.25&&b.level<xi.length-1?(b.level++,b.good=0,e-b.raisedAt<Uf&&(b.held=!0)):r<=.02&&!b.held&&b.level>0&&++b.good>=8?(b.level--,b.good=0,b.raisedAt=e):r>.02&&(b.good=0),b.scale=xi[b.level]}function tt(){b.raf||(b.raf=requestAnimationFrame(Wf))}function Wf(e){b.raf=0;let t=0,r=0;for(let l of b.instances)l.el.isConnected?l.visible?t++:l.near&&l.dirty&&r++:Vf(l);if(!t&&!r){b.gl&&!b.idleSince&&(b.idleSince=e),b.gl&&e-b.idleSince>8e3?wf():b.gl&&setTimeout(tt,2e3),b.lastTick=0;return}if(b.idleSince=0,!_f()){for(let l of b.instances)we(l,"WebGL2 is not available");return}let a=Xt(),n=!1,i=!1;b.compileUntil=performance.now()+24;let s=!1;for(let l of b.instances)!(l.visible||l.near)||!l.dirty||(yo(l),l.dirty&&(s=!0));s&&(n=!0);let c=s&&!b.parallel;for(let l of b.instances){if(!l.visible||l.error&&!l.dirty)continue;let f=l.running&&!a&&l.speed>0;if(!(f||l.needsFrame||jf(l)||l.def?.image&&l.source instanceof HTMLVideoElement&&!l.source.paused)){l.last=0;continue}if(c&&l.frames&&!l.needsFrame&&!l.dirty){n=!0;continue}if(f&&(i=!0),f&&l.fps&&l.last&&e-l.last<1e3/l.fps-1){n=!0;continue}let g=l.last?Math.min((e-l.last)/1e3,.1):1/60;l.last=e,l.dirty&&yo(l),l.colorsDirty&&l.def&&!l.error&&_o(l),l.easing=!!l.def&&!l.error&&If(l,g);let d=Ff(l,g)||l.easing;f&&(l.time+=g*l.speed),l.needsFrame=!1,Df(l,f?g*l.speed:0),(f||d||l.imageDirty)&&(n=!0),l.dirty&&(l.needsFrame=n=!0)}b.compileUntil=0,i?Bf(e):b.lastTick=0,n&&tt()}function H(e,t=!1){t&&(e.imageDirty=!0),e.needsFrame=!0,tt()}function Vf(e){rt(e),b.gl&&e.texture&&b.gl.deleteTexture(e.texture),e.texture=null,b.io?.unobserve(e.el),b.near?.unobserve(e.el),b.ro?.unobserve(e.el),e.attrObserver?.disconnect(),b.instances.delete(e);for(let t of e.waiters.splice(0))t()}function vo(e){for(let t of b.instances){if(!t.interactive||!t.visible)continue;let o=((t.variant==="background"||t.variant==="border")&&t.el.parentElement||t.el).getBoundingClientRect(),a=e.type!=="pointerleave"&&e.clientX>=o.left&&e.clientX<=o.right&&e.clientY>=o.top&&e.clientY<=o.bottom,n=t.el.getBoundingClientRect();if(a&&n.width&&n.height){let s=(e.clientX-n.left)/n.width,c=1-(e.clientY-n.top)/n.height;t.lastEvent&&t.splats.push({x:s,y:c,dx:s-t.lastEvent[0],dy:c-t.lastEvent[1]}),t.splats.length>12&&t.splats.splice(0,t.splats.length-12),e.type==="pointerdown"&&(t.taps.push([s,c,t.time]),t.taps.length>8&&t.taps.shift(),t.taps.forEach((l,f)=>t.tapData.set(l,f*3))),t.lastEvent=[s,c],t.pointerTarget=[s,c]}else t.lastEvent=null;let i=a?1:0;(i!==t.hoverTarget||a)&&(t.hoverTarget=i,H(t))}}function qt(){for(let e of b.instances)e.colorsDirty=!0,e.colorsSnap=!0,H(e)}var _i=!1;function Hf(){if(_i)return;_i=!0,globalThis.IntersectionObserver&&(b.io=new IntersectionObserver(t=>{for(let r of t){let o=r.target._shader;o&&(o.visible=r.isIntersecting,o.visible&&H(o))}},{rootMargin:"0px"}),b.near=new IntersectionObserver(t=>{for(let r of t){let o=r.target._shader;o&&(o.near=r.isIntersecting,o.near&&o.dirty&&tt())}},{rootMargin:"20% 0px"})),globalThis.ResizeObserver&&(b.ro=new ResizeObserver(t=>{for(let r of t){let o=r.target._shader;o&&(o.cssW=o.el.clientWidth,o.cssH=o.el.clientHeight,Ci(o),H(o))}})),O(document).on("pointermove",vo),O(document).on("pointerdown",vo),O(document.documentElement).on("pointerleave",vo),O(document).on("defuss-theme-change",()=>setTimeout(qt,60)),document.addEventListener("load",t=>t.target instanceof HTMLLinkElement&&qt(),!0);let e=(()=>{let t=0;return()=>{clearTimeout(t),t=setTimeout(qt,30)}})();new MutationObserver(e).observe(document.documentElement,{attributes:!0,attributeFilter:["class","style","data-theme"]}),document.head&&new MutationObserver(e).observe(document.head,{childList:!0,subtree:!0,characterData:!0,attributes:!0,attributeFilter:["href"]}),globalThis.matchMedia?.("(prefers-color-scheme: dark)").addEventListener?.("change",qt),globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").addEventListener?.("change",()=>{for(let t of b.instances)H(t)})}var Re={effect:"data-effect",speed:"data-speed",colors:"data-colors"};function Ni(e,t,r){for(let o in Re){let a=r?.[o];a!=null&&a!==""&&O(e).attr(Re[o],String(a))}}function Gf(e,t,r,o){Ni(e,t,r);let a=e._shader;a&&(a.running=t==="default",o&&o.time!==void 0&&o.time!==null&&o.time!==""&&(a.time=te(o.time,a.time),a.timeSet=!0),a.dirty=!0,H(a))}var $i=hf({component:"shader",states:Ti,mergeConfig:!0,apply:(e,t,r,o)=>{e.dataset.stateName=t.name,Gf(e,t.name,t.config,o)},read:(e,t)=>{let r={...t.config};for(let o in Re)o in r&&e.hasAttribute(Re[o])&&(r[o]=o==="speed"?te(e.getAttribute(Re[o]),r[o]):e.getAttribute(Re[o]));return{name:e.dataset.stateName==="paused"?"paused":"default",config:r}},markup:(e,t)=>Ni(e,t.name,t.config)});Gt.shaderApi=$i;Gt.shaderStates=Ti;var Xf=e=>typeof e=="string"?O(e).get(0):e;Gt.shader={effects:()=>Object.keys(Ut).concat("custom"),options:e=>{let t=Ut[e]?.options||{};return Object.fromEntries(Object.entries(t).map(([r,o])=>[r,[...o]]))},register:(e,t)=>{if(!/^[a-z][a-z0-9-]*$/.test(e)||e==="custom")throw new Error(`shader: "${e}" is no effect name`);if(!t||typeof t.fragment!="string"||!t.fragment.trim())throw new Error(`shader: effect "${e}" needs a fragment shader`);for(let r in t.options||{})if(!Array.isArray(t.options[r])||!t.options[r].length)throw new Error(`shader: option "${r}" of "${e}" needs a list of words`);Ut[e]={...t};for(let r of b.instances)(r.effect===e||r.el.dataset.effect===e)&&(r.dirty=!0,H(r))},stats:()=>{let e=0,t=0,r=Xt();for(let o of b.instances)o.visible&&(e++,o.running&&!r&&o.speed>0&&!o.error&&t++);return{supported:!b.unsupported,contexts:b.gl?1:0,programs:b.programs.size,instances:b.instances.size,visible:e,animating:t,frames:b.frames,scale:b.scale}},frame:e=>{let t=Xf(e)?._shader;return!t||!t.visible||t.error?Promise.resolve():new Promise(r=>{t.waiters.push(r),t.colorsDirty=!0,t.imageDirty=!0,H(t)})}};var Kf={angle:[-90,90,1],light:[0,360,1],direction:[0,360,1],rotation:[0,360,1],elevation:[5,85,1],decay:[.9,.999,.001],origin_x:[-.5,1.5,.01],origin_y:[-.5,1.5,.01],tilt:[0,1,.01],variation:[0,1,.01],cover:[0,1,.01],density:[0,1,.01],fog:[0,2,.01],line:[.01,.3,.005],scale:[1,30,.5],spacing:[8,80,1],segments:[2,24,1],pixel:[1,12,1],cell:[3,32,1]};function Jf(e,t){let r=e.ranges?.[t]||Kf[t];if(r)return r;let o=e.params?.[t]??1;if(Number.isInteger(o)&&o>=2)return[1,Math.max(o*3,10),1];let a=Math.max(Math.abs(o)*2.5,1);return[o<0?-a:0,a,10**Math.floor(Math.log10(a/100))]}var xo=e=>e.replace(/_/g," ").replace(/^./,t=>t.toUpperCase()),le=e=>e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/"/g,"&quot;"),Yf=(e,t)=>`#${[0,1,2].map(r=>Math.round(Math.min(Math.max(e[t*3+r],0),1)*255).toString(16).padStart(2,"0")).join("")}`,wi=e=>`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${e}"/></svg>`,Qf=0;function ki(e,t,r,o,a){let n=r.map(i=>`<option value="${le(i)}"${i===o?" selected":""}>${le(i)}</option>`).join("");return`<div class="shader-controls-field"><label class="label" for="${e}">${le(xo(t))}</label><div class="shader-controls-cycle" role="group" aria-label="${le(xo(t))}"><button type="button" class="btn" data-variant="outline" data-size="icon-sm" id="${e}-prev" data-shader-step="-1" aria-label="Previous ${le(t)}">${wi("m15 18-6-6 6-6")}</button><select class="select" id="${e}" data-shader-${a}="${le(t)}">${n}</select><button type="button" class="btn" data-variant="outline" data-size="icon-sm" id="${e}-next" data-shader-step="1" aria-label="Next ${le(t)}">${wi("m9 18 6-6-6-6")}</button></div></div>`}function Ai(e,t,[r,o,a],n,i){return`<div class="shader-controls-field"><div class="shader-controls-head"><label class="label" for="${e}">${le(xo(t))}</label><output class="slider-value" for="${e}">${n}</output></div><input class="slider" type="range" id="${e}" min="${r}" max="${o}" step="${a}" value="${n}" data-shader-${i}="${le(t)}" /></div>`}function Zf(e,t,r){let o=r.def,a=e.id||(e.id=`shader-controls-${++Qf}`),n=(e.dataset.controls||"options params colors speed actions").split(/\s+/).filter(Boolean),i=c=>t.getAttribute(`data-${c.replace(/_/g,"-")}`),s="";for(let c of n)if(c==="effect")s+=ki(`${a}-effect`,"effect",Gt.shader.effects().filter(l=>l!=="custom"),r.effect,"control");else if(c==="options")for(let[l,f]of Object.entries(o.options||{}))s+=ki(`${a}-${l}`,l,f,f.includes(i(l)||"")?i(l):f[0],"option");else if(c==="params")for(let l of Object.keys(o.params||{}))s+=Ai(`${a}-${l}`,l,Jf(o,l),te(i(l),o.params[l]),"param");else c==="speed"?s+=Ai(`${a}-speed`,"speed",[0,3,.05],r.speed,"control"):c==="colors"&&r.colorCount?s+=`<div class="shader-controls-field"><span class="label" id="${a}-colors-label">Colors</span><div class="shader-controls-colors" role="group" aria-labelledby="${a}-colors-label">${Array.from({length:r.colorCount},(l,f)=>`<input type="color" value="${Yf(r.colors,f)}" data-shader-color="${f}" aria-label="Color ${f+1}" />`).join("")}</div></div>`:c==="actions"&&(s+=`<div class="shader-controls-actions"><button type="button" class="btn" data-variant="outline" data-size="sm" data-shader-action="pause" aria-pressed="${r.running?"false":"true"}">${r.running?"Pause":"Play"}</button><button type="button" class="btn" data-variant="ghost" data-size="sm" data-shader-action="reset">Reset</button></div>`);return s}function Pt(e,t,r){let o=e._controlled??=new Map;o.has(t)||o.set(t,e.getAttribute(t)),O(e).attr(t,r)}function Ei(e){for(let[t,r]of e._controlled||[])r===null?e.removeAttribute(t):O(e).attr(t,r);e._controlled?.clear()}function Bt(e,t){for(let r of b.controls){if(!r.isConnected){b.controls.delete(r);continue}if(Wt(r)!==e.el)continue;if(t||!r._rendered){r._rendered=!0;let a=r.ownerDocument.activeElement,n=a&&r.contains(a)?a.id:"";O(r).html(Zf(r,e.el,e)),n&&O(`#${CSS.escape(n)}`).get(0)?.focus();continue}O(r).find("[data-shader-option]").toArray().forEach(a=>{let n=a.dataset.shaderOption,i=e.def.options?.[n]||[],s=e.el.getAttribute(`data-${n.replace(/_/g,"-")}`)||"",c=i.includes(s)?s:i[0];c!==void 0&&a.value!==c&&(a.value=c)});let o=O(r).find('[data-shader-control="speed"]').get(0);o&&r.ownerDocument.activeElement!==o&&o.value!==String(e.speed)&&(o.value=String(e.speed)),O(r).find("[data-shader-param]").toArray().forEach(a=>{let n=a.dataset.shaderParam,i=String(te(e.el.getAttribute(`data-${n.replace(/_/g,"-")}`),e.def.params?.[n]??0));a.value!==i&&r.ownerDocument.activeElement!==a&&(a.value=i)}),O(r).find('[data-shader-action="pause"]').toArray().forEach(a=>{O(a).attr("aria-pressed",e.running?"false":"true"),O(a).text(e.running?"Pause":"Play")})}}var Wt=e=>{let t=e.dataset.shaderFor||"";return t?O(`#${CSS.escape(t)}`).get(0):void 0};function eu(e){b.controls.add(e);let t=o=>{let a=Wt(e),n=a?._shader;if(!(!a||!n)){if(o.dataset.shaderOption)Pt(a,`data-${o.dataset.shaderOption.replace(/_/g,"-")}`,o.value);else if(o.dataset.shaderParam)Pt(a,`data-${o.dataset.shaderParam.replace(/_/g,"-")}`,o.value);else if(o.dataset.shaderColor){let i=O(e).find("[data-shader-color]").toArray().map(s=>s.value);Pt(a,"data-colors",i.join(" "))}else if(o.dataset.shaderControl==="speed")Pt(a,"data-speed",o.value);else if(o.dataset.shaderControl==="effect"){let i=a._controlled?.has("data-effect")?a._controlled.get("data-effect"):a.getAttribute("data-effect");Ei(a),(a._controlled??=new Map).set("data-effect",i),O(a).attr("data-effect",o.value)}}};O(e).on("input",o=>t(o.target)),O(e).on("change",o=>{o.target instanceof HTMLSelectElement&&t(o.target)}),O(e).on("click",o=>{let a=o.target.closest("button");if(!a||!e.contains(a))return;let n=Wt(e);if(n?._shader)if(a.dataset.shaderStep){let i=O(a).parent().find("select").get(0),s=i.options.length;i.selectedIndex=(i.selectedIndex+Number(a.dataset.shaderStep)+s)%s,t(i)}else a.dataset.shaderAction==="pause"?(n.api.setState(n._shader.running?"paused":"default"),Bt(n._shader,!1)):a.dataset.shaderAction==="reset"&&(Ei(n),Bt(n._shader,!0))});let r=Wt(e)?._shader;r?.def&&Bt(r,!0)}function Li(){O(".shader:not([data-init])").toArray().forEach(e=>{e.dataset.init="";for(let a of Array.from(e.children))a.classList.contains("shader-canvas")&&a.remove();let t=document.createElement("canvas");t.className="shader-canvas",t.setAttribute("aria-hidden","true"),e.append(t),Hf();let r={el:e,canvas:t,ctx:t.getContext("2d"),visible:!b.io,near:!b.near,running:!0,needsFrame:!0,dirty:!0,colorsDirty:!0,imageDirty:!0,time:0,timeSet:!1,delta:0,last:0,frames:0,ready:!1,error:"",effect:"",def:null,prog:null,params:{},speed:1,fps:0,quality:"auto",variant:"",interactive:!1,seed:0,colors:new Float32Array(24),colorCount:0,background:[0,0,0,0],cssW:e.clientWidth,cssH:e.clientHeight,scale:1,w:0,h:0,frame:[0,0],pointer:[.5,.5],pointerTarget:[.5,.5],hover:0,hoverTarget:0,splats:[],taps:[],tapData:new Float32Array(24),lastEvent:null,source:null,texture:null,hasImage:0,imageCanvas:null,svgImage:null,sim:null,waiters:[],attrObserver:null};e._shader=r,b.instances.add(r);let o=a=>a===t||a instanceof Element&&a.classList.contains("shader-probe");r.attrObserver=new MutationObserver(a=>{a.filter(i=>o(i.target)?!1:i.type==="attributes"?!(i.target===e&&/^data-(init|ready|state-name|fallback|image|api)$/.test(i.attributeName||"")):i.type==="childList"?![...i.addedNodes,...i.removedNodes].every(o):!0).length&&(r.colorsDirty=!0,r.dirty=!0,r.imageDirty=!0,H(r))}),r.attrObserver.observe(e,{attributes:!0,childList:!0,subtree:!0,characterData:!0}),b.io?.observe(e),b.near?.observe(e),b.ro?.observe(e),gf(e,$i,{name:"default",config:{}}),e.dataset.stateName="default",H(r)}),O(".shader-controls[data-shader-for]:not([data-init])").toArray().forEach(e=>{e.dataset.init="",eu(e)})}Li();new MutationObserver(Li).observe(document,{childList:!0,subtree:!0});
