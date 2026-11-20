import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const contactsStart = html.indexOf('        // Construire une carte par interlocuteur.');
const contactsEnd = html.indexOf('        window.toggleAjoutContact = function()', contactsStart);
assert(contactsStart >= 0 && contactsEnd > contactsStart, 'section Contacts trouvée');
const contactsSection = html.slice(contactsStart, contactsEnd);
const conversationStart = html.indexOf('        function cleConversation(');
const conversationEnd = html.indexOf('        function timestampEnMillisecondes(', conversationStart);
assert(conversationStart >= 0 && conversationEnd > conversationStart, 'fonctions de conversation trouvées');
const conversationSection = html.slice(conversationStart, conversationEnd);
const inboxStart = html.indexOf('        function ecouterMessagesBailleur() {');
const inboxEnd = html.indexOf('        function initialiserLogementsMessagerieLocataire()', inboxStart);
assert(inboxStart >= 0 && inboxEnd > inboxStart, 'liste des conversations bailleur trouvée');
const inboxSection = html.slice(inboxStart, inboxEnd);

class FakeElement {
  constructor(id = '') {
    this.id = id;
    this.style = {};
    this.dataset = {};
    this.children = [];
    this.className = '';
    this.options = [];
    this.value = '';
    this.textContent = '';
    this.innerText = '';
    this.innerHTML = '';
    this.classList = { add(){}, remove(){}, toggle(){} };
  }
  replaceChildren() { this.children = []; this.options = []; }
  appendChild(child) {
    this.children.push(child);
    if(this.id === 'bai-dest-select') this.options.push(child);
    return child;
  }
  addEventListener(name, cb) { this['on' + name] = cb; }
  setAttribute(name, value) { this[name] = value; }
}

function run(role, contracts, currentEmail, currentName, messages = []) {
  const elements = new Map();
  const document = {
    getElementById(id) {
      if(!elements.has(id)) elements.set(id, new FakeElement(id));
      return elements.get(id);
    },
    createElement(tag) { return new FakeElement(tag); }
  };
  const data = { contrats: contracts, messages };
  const calls = { tabs: [], renders: [] };
  const window = { innerWidth: 390 };
  const local = new Map();
  const localStorage = { getItem:k=>local.get(k)||null, setItem:(k,v)=>local.set(k,String(v)) };
  const db = {
    _getStore:name=>data[name]||[], _subscribe(){}, _cache:{}, _cacheReady:{},
    collection:()=>({ where:()=>({ onSnapshot:callback=>callback({ forEach:fn=>messages.forEach((m,i)=>fn({id:String(i),data:()=>m})) }) }) })
  };
  const normaliserTexte = s => String(s||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const cleLogement = (adresse, lot) => normaliserTexte([adresse||'',lot||''].filter(Boolean).join('|'));
  const libelleLogement = (adresse, lot) => [lot?'Lot '+lot:'',adresse||''].filter(Boolean).join(' — ');
  const timestampEnMillisecondes = value => {
    const ms = Date.parse(value || '');
    return Number.isFinite(ms) ? ms : 0;
  };
  const valeurTimestampClient = m => m.timestampClient||m.timestamp||'';
  const echapperHtmlMGI = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const estEnLigne = () => false;
  const mettreAJourDestSelect = () => {};
  const afficherMessagesDepuisCache = (...args) => calls.renders.push(args);
  const showTab = id => calls.tabs.push(id);
  const marquerEnLigne = () => {};
  const initialiserLogementsMessagerieLocataire = () => {
    window._logementsMessagerie = contracts.map(c => ({
      key:cleLogement(c.adresse,c.lot)||'principal', adresse:c.adresse||'', lot:c.lot||'',
      bailleurEmail:c.bailleurEmail||'', contratId:c.id||c._id||''
    }));
  };
  let _messagesBailleurUnsubscribe = null;
  let _mgiMessageNotificationReady = false;
  const notifierNouveauMessage = () => {};
  window.changerLogementMessagerie = key => { window._logementMessagerieActif=key; };
  window._rendreMessagesLocataire = () => calls.renders.push(['tenant-render', window._logementMessagerieActif]);
  const context = vm.createContext({
    window, document, localStorage, db, calls, normaliserTexte, cleLogement, libelleLogement,
    timestampEnMillisecondes, valeurTimestampClient, echapperHtmlMGI, estEnLigne,
    mettreAJourDestSelect, afficherMessagesDepuisCache, showTab, marquerEnLigne,
    initialiserLogementsMessagerieLocataire, roleActuel:role,
    _messagesBailleurUnsubscribe, _mgiMessageNotificationReady, notifierNouveauMessage,
    utilisateurEmail:currentEmail, utilisateurNom:currentName, currentTenantId:'',
    Option:class { constructor(text,value){this.text=text;this.value=value;} }
  });
  new vm.Script(`${conversationSection}\n${inboxSection}\n${contactsSection}\nthis.api={
    obtenirContacts, open:c=>window.ouvrirConvDepuisContact(c),
    renderBailleurInbox:()=>{ecouterMessagesBailleur();return document.getElementById('bai-tenant-list');},
    messageMatches:(m,bailleur,locataire,logement)=>messageDansConversation(m,bailleur,locataire,'',logement),
    getActive:()=>window._conversationBailleurActive, getTenant:()=>window._contactBailleurActif,
    getTabs:()=>calls.tabs, getRenders:()=>calls.renders,
    getContactCard:()=>document.getElementById('contacts-list').children[0],
    last:(e,n,k)=>dernierMessage(e,n,k), sameThread:(a,b,k)=>cleConversation(a,b,'','',k)
  };`).runInContext(context);
  return context.api;
}

const landlordContracts = [
  {id:'contract-a', bailleurEmail:'bailleur@example.test', locataireEmail:'locataire@example.test', bailleur:'Bailleur Test', locataire:'Alice Dupont', adresse:'Rue A', lot:'1'},
  {id:'contract-b', bailleurEmail:'bailleur@example.test', locataireEmail:'locataire@example.test', bailleur:'Bailleur Test', locataire:'Alice Dupont', adresse:'Rue B', lot:'2'}
];
const messages = [
  { bailleurEmail:'bailleur@example.test', locataireEmail:'locataire@example.test', locataireNom:'Alice Dupont', logementKey:'rue a|1', logementAdresse:'Rue A', logementLot:'1', texte:'Message logement A', timestampClient:'2026-11-19T10:00:00Z' },
  { bailleurEmail:'bailleur@example.test', locataireEmail:'locataire@example.test', locataireNom:'Alice Dupont', logementKey:'rue b|2', logementAdresse:'Rue B', logementLot:'2', texte:'Message logement B', timestampClient:'2026-11-19T11:00:00Z' }
];

const landlordApi = run('bailleur', landlordContracts, 'bailleur@example.test', 'Bailleur Test', messages);
const landlordContacts = landlordApi.obtenirContacts();
assert.equal(landlordContacts.length, 1, 'le bailleur voit une seule fiche par locataire');
assert.equal(landlordContacts[0].nom, 'Alice Dupont', 'le nom du locataire reste affiché');
assert.equal(landlordContacts[0].logements.length, 2, 'la fiche regroupe les deux logements');
assert.equal(landlordContacts[0].contrats.length, 2, 'les deux contrats restent sélectionnables');
assert.equal(landlordApi.last(landlordContacts[0].email, landlordContacts[0].nom, '').texte, 'Message logement B', 'l’aperçu agrège les messages et montre le plus récent');
assert.ok(messages.every(m => landlordApi.messageMatches(m, 'bailleur@example.test', 'locataire@example.test', 'un-logement-different')), 'les messages de tous les logements restent dans le fil unique');
assert.equal(landlordApi.messageMatches(messages[0], 'bailleur@example.test', 'autre@example.test', ''), false, 'un autre interlocuteur reste exclu du fil');
const landlordInbox = landlordApi.renderBailleurInbox();
assert.equal(landlordInbox.children.length, 1, 'la messagerie affiche un seul interlocuteur malgré deux logements');
assert.match(landlordInbox.children[0].innerHTML, /2 logements/, 'la ligne de messagerie signale les logements associés');
const secondContractContext = { ...landlordContacts[0], ...landlordContacts[0].contrats.find(c => c.contratId === 'contract-b') };
landlordApi.open(secondContractContext);
assert.equal(landlordApi.getTabs().at(-1), 'box-messagerie', 'le bailleur arrive directement dans Messagerie');
assert.equal(landlordApi.getActive().contratId, 'contract-b', 'le contrat choisi reste associé à l’envoi');
assert.equal(landlordApi.getRenders().at(-1)[3], 'bai-msg-thread', 'le fil unique bailleur est rendu immédiatement');
assert.match(landlordApi.getContactCard().innerHTML, /2 logements/, 'la fiche affiche le nombre de logements');
assert.equal(landlordApi.sameThread('bailleur@example.test', 'locataire@example.test', 'rue-a'), landlordApi.sameThread('bailleur@example.test', 'locataire@example.test', 'rue-b'), 'les logements n’entrent pas dans l’identité du fil');

const tenantContracts = landlordContracts;
const tenantApi = run('locataire', tenantContracts, 'locataire@example.test', 'Alice Dupont', messages);
const tenantContacts = tenantApi.obtenirContacts();
assert.equal(tenantContacts.length, 1, 'le locataire voit une seule fiche par bailleur');
assert.equal(tenantContacts[0].nom, 'Bailleur Test', 'le nom du bailleur reste affiché');
assert.equal(tenantContacts[0].logements.length, 2, 'la fiche bailleur regroupe les deux logements');
const tenantSecondContext = { ...tenantContacts[0], ...tenantContacts[0].contrats.find(c => c.contratId === 'contract-b') };
tenantApi.open(tenantSecondContext);
assert.equal(tenantApi.getTabs().at(-1), 'box-messagerie', 'le locataire arrive directement dans Messagerie');
assert.equal(tenantApi.getTenant().contratId, 'contract-b', 'le contrat de réponse reste sélectionné côté locataire');
assert.equal(tenantApi.getRenders().at(-1)[1], 'rue b|2', 'le contexte du logement choisi reste actif');
assert.equal(tenantApi.getRenders().at(-1)[0], 'tenant-render', 'le fil locataire est rafraîchi directement');
assert.match(tenantApi.getContactCard().innerHTML, /2 logements/, 'la fiche bailleur affiche le nombre de logements');
console.log('PASS: une fiche et un fil par personne, plusieurs logements et contrats conservés pour contextualiser les messages.');
