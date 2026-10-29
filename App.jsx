import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { supabase } from './supabase.js';

const CANTILAN = [9.333, 125.95]; // approximate town-center map starting point, not a verified address
const markerIcon = (emoji, color) => L.divIcon({
  className: 'emoji-marker',
  html: `<span style="background:${color}">${emoji}</span>`,
  iconSize: [38, 38], iconAnchor: [19, 19]
});
const tricycleIcon = markerIcon('🛺', '#08784e');
const pickupIcon = markerIcon('📍', '#2563eb');
const destinationIcon = markerIcon('🏁', '#c2410c');

function Recenter({ center }) {
  const map = useMap();
  useEffect(() => { if (center) map.setView(center, Math.max(map.getZoom(), 14)); }, [center, map]);
  return null;
}
function timeLabel(value) {
  if (!value) return 'Just now';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
}

export default function App() {
  const [mode, setMode] = useState('passenger');
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [notice, setNotice] = useState('');
  const [drivers, setDrivers] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [myLocation, setMyLocation] = useState(null);
  const [pickup, setPickup] = useState('');
  const [destination, setDestination] = useState('');
  const [fare, setFare] = useState('');
  const [driverName, setDriverName] = useState('');
  const [todaName, setTodaName] = useState('Cantilan TODA');
  const [plate, setPlate] = useState('');
  const [online, setOnline] = useState(false);
  const [busy, setBusy] = useState(false);
  const configured = Boolean(supabase);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({data}) => setSession(data.session));
    const {data:{subscription}} = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!supabase) return;
    let channel;
    const load = async () => {
      const [{data: d, error: de}, {data: b, error: be}] = await Promise.all([
        supabase.from('drivers').select('*').eq('is_online', true),
        supabase.from('bookings').select('*').order('created_at', {ascending:false}).limit(50)
      ]);
      if (de) setNotice(de.message);
      else setDrivers(d || []);
      if (be) setNotice(be.message);
      else setBookings(b || []);
    };
    load();
    channel = supabase.channel('toda-go-live')
      .on('postgres_changes', {event:'*', schema:'public', table:'drivers'}, load)
      .on('postgres_changes', {event:'*', schema:'public', table:'bookings'}, load)
      .subscribe();
    return () => { if (channel) supabase.removeChannel(channel); };
  }, [session]);

  useEffect(() => {
    if (!supabase || !session?.user) return;
    supabase.from('drivers').select('*').eq('user_id', session.user.id).maybeSingle().then(({data}) => {
      if (!data) return;
      setDriverName(data.name || '');
      setTodaName(data.toda_name || 'Cantilan TODA');
      setPlate(data.plate_number || '');
      setOnline(Boolean(data.is_online));
    });
  }, [session]);

  useEffect(() => {
    if (!online || mode !== 'driver' || !session?.user || !navigator.geolocation || !supabase) return;
    let watchId;
    watchId = navigator.geolocation.watchPosition(async (pos) => {
      const coords = {lat: pos.coords.latitude, lng: pos.coords.longitude, updated_at: new Date().toISOString()};
      setMyLocation([coords.lat, coords.lng]);
      const {error} = await supabase.from('drivers').update(coords).eq('user_id', session.user.id);
      if (error) setNotice('Hindi na-update ang GPS: ' + error.message);
    }, (err) => setNotice('Hindi ma-access ang GPS. Payagan ang location sa browser. ' + err.message),
    {enableHighAccuracy:true, maximumAge:5000, timeout:15000});
    return () => navigator.geolocation.clearWatch(watchId);
  }, [online, mode, session]);

  const mapCenter = myLocation || (drivers[0]?.lat && drivers[0]?.lng ? [drivers[0].lat, drivers[0].lng] : CANTILAN);
  const myBooking = useMemo(() => bookings.find(b => b.passenger_id === session?.user?.id && !['completed','cancelled','rejected'].includes(b.status)), [bookings, session]);

  async function signIn(e) {
    e.preventDefault(); if (!supabase) return;
    setBusy(true); setNotice('');
    const {error} = await supabase.auth.signInWithPassword({email, password});
    if (error) setNotice(error.message);
    setBusy(false);
  }
  async function signUp() {
    if (!supabase) return;
    setBusy(true); setNotice('');
    const {error} = await supabase.auth.signUp({email, password});
    setNotice(error ? error.message : 'Account created. Check your email if confirmation is enabled, then sign in.');
    setBusy(false);
  }
  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut(); setOnline(false); setNotice('Signed out.');
  }
  async function saveDriver() {
    if (!session?.user) return setNotice('Mag-sign in muna bago mag-save ng driver profile.');
    if (!driverName.trim()) return setNotice('Ilagay ang pangalan ng driver.');
    setBusy(true); setNotice('');
    const {error} = await supabase.from('drivers').upsert({
      user_id:session.user.id, name:driverName.trim(), toda_name:todaName.trim(),
      plate_number:plate.trim(), is_online:online, updated_at:new Date().toISOString()
    }, {onConflict:'user_id'});
    setNotice(error ? error.message : 'Na-save ang driver profile.');
    setBusy(false);
  }
  async function toggleOnline() {
    if (!session?.user) return setNotice('Mag-sign in muna para maging online bilang driver.');
    if (!driverName.trim()) return setNotice('I-save muna ang driver profile at pangalan.');
    const next = !online;
    setBusy(true); setNotice('');
    const {error} = await supabase.from('drivers').upsert({
      user_id:session.user.id, name:driverName.trim(), toda_name:todaName.trim(),
      plate_number:plate.trim(), is_online:next, updated_at:new Date().toISOString()
    }, {onConflict:'user_id'});
    if (error) setNotice(error.message);
    else { setOnline(next); setNotice(next ? 'Online ka na. Panatilihing bukas ang app habang tumatanggap ng biyahe.' : 'Offline ka na.'); }
    setBusy(false);
  }
  async function requestRide(e) {
    e.preventDefault();
    if (!session?.user) return setNotice('Mag-sign in muna para makapag-book.');
    if (!pickup.trim() || !destination.trim()) return setNotice('Ilagay ang pickup at destination.');
    setBusy(true); setNotice('');
    const {error} = await supabase.from('bookings').insert({
      passenger_id:session.user.id, pickup_text:pickup.trim(), destination_text:destination.trim(),
      fare_estimate:fare === '' ? null : Number(fare), status:'requested'
    });
    setNotice(error ? error.message : 'Naipadala ang booking request. Hintayin ang sagot ng driver.');
    setBusy(false);
  }
  async function respondBooking(id, status) {
    if (!session?.user) return;
    const {error} = await supabase.from('bookings').update({status, driver_id:session.user.id, updated_at:new Date().toISOString()})
      .eq('id', id).eq('status','requested');
    setNotice(error ? error.message : `Booking ${status === 'accepted' ? 'tinanggap' : 'tinanggihan'}.`);
  }

  return <div className="shell">
    <header className="hero">
      <div className="brand"><div className="logo">🛺</div><div><div className="wordmark">TODA GO</div><div className="tagline">Sakay dali. Biyahe safe.</div></div></div>
      <div className="hero-bottom"><div><div className="welcome">Maayong adlaw!</div><p>Cantilan, Surigao del Sur</p></div><span className="pilot">PILOT</span></div>
    </header>
    {!configured && <div className="setup-alert"><b>Setup pa lang:</b> Kopyahin ang <code>.env.example</code> bilang <code>.env</code>, ilagay ang Supabase URL at publishable/anon key, at patakbuhin ang SQL file sa README. Wala pang live booking hanggang makumpleto ito.</div>}
    <main>
      <div className="mode-tabs"><button className={mode==='passenger'?'selected':''} onClick={()=>setMode('passenger')}>🙋 Pasahero</button><button className={mode==='driver'?'selected':''} onClick={()=>setMode('driver')}>🛺 Driver</button></div>
      <section className="card auth">
        <div className="card-title"><div><h2>Account</h2><p>Gumamit ng account para ma-link ang booking.</p></div>{session && <button className="text-btn" onClick={signOut}>Sign out</button>}</div>
        {session ? <div className="signed-in"><span className="green-dot"></span>Signed in: <b>{session.user.email}</b></div> :
          <form onSubmit={signIn}><label>Email</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" required/>
          <label>Password</label><input type="password" value={password} onChange={e=>setPassword(e.target.value)} minLength="6" placeholder="At least 6 characters" required/>
          <div className="row"><button className="btn primary" disabled={!configured||busy}>Sign in</button><button type="button" className="btn secondary" disabled={!configured||busy} onClick={signUp}>Create account</button></div></form>}
      </section>
      <section className="map-card">
        <div className="map-heading"><div><h2>Driver map</h2><p>{drivers.length} online driver{drivers.length===1?'':'s'} · live updates kapag naka-connect</p></div><span className="map-pin">📍</span></div>
        <MapContainer center={CANTILAN} zoom={13} scrollWheelZoom={false} className="map">
          <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <Recenter center={mapCenter}/>
          {drivers.filter(d=>Number.isFinite(d.lat)&&Number.isFinite(d.lng)).map(d=><Marker key={d.id} position={[d.lat,d.lng]} icon={tricycleIcon}><Popup><b>{d.name}</b><br/>{d.toda_name || 'TODA'}<br/>Plate: {d.plate_number || 'Not listed'}<br/>Updated: {timeLabel(d.updated_at)}</Popup></Marker>)}
          {myLocation && <Marker position={myLocation} icon={pickupIcon}><Popup>Current device location</Popup></Marker>}
        </MapContainer>
        <p className="map-note">Map center is an approximate Cantilan town-center starting point. GPS requires permission and HTTPS. Only online drivers with coordinates appear.</p>
      </section>

      {mode==='passenger' ? <>
        <section className="card">
          <div className="card-title"><div><h2>Asa ta padulong?</h2><p>Mag-request ng tricycle ride</p></div><span>🚏</span></div>
          <form onSubmit={requestRide}>
            <label>Pickup location</label><input value={pickup} onChange={e=>setPickup(e.target.value)} placeholder="Hal. Cantilan Public Market" required/>
            <label>Destination</label><input value={destination} onChange={e=>setDestination(e.target.value)} placeholder="Hal. Barangay / landmark" required/>
            <label>Estimated fare (₱) — optional</label><input type="number" min="0" step="1" value={fare} onChange={e=>setFare(e.target.value)} placeholder="Ilagay kung napagkasunduan na"/>
            <button className="btn primary full" disabled={!configured||busy}>🚕 Mag-book ng tricycle</button>
            <p className="fineprint">Tinatayang pamasahe lamang. Kumpirmahin ang aktuwal na pamasahe sa driver bago bumiyahe.</p>
          </form>
        </section>
        {myBooking && <section className="card"><div className="card-title"><div><h2>Booking status</h2><p>Live status updates</p></div><span className="status">{myBooking.status}</span></div><p><b>{myBooking.pickup_text}</b> → <b>{myBooking.destination_text}</b></p><p className="fineprint">Kapag tinanggap na ng driver, ipapakita rito ang status. Push notifications ay hindi pa naka-setup.</p></section>}
      </> : <>
        <section className="card">
          <div className="card-title"><div><h2>Driver profile</h2><p>Irehistro ang driver at tricycle</p></div><span>🪪</span></div>
          <label>Driver name</label><input value={driverName} onChange={e=>setDriverName(e.target.value)} placeholder="Buong pangalan"/>
          <label>TODA / Barangay</label><input value={todaName} onChange={e=>setTodaName(e.target.value)} placeholder="TODA name"/>
          <label>Plate number</label><input value={plate} onChange={e=>setPlate(e.target.value)} placeholder="Plate number"/>
          <button className="btn secondary full" onClick={saveDriver} disabled={!configured||busy}>I-save ang profile</button>
          <button className={`btn full ${online?'danger':'primary'}`} onClick={toggleOnline} disabled={!configured||busy}>{online?'Go offline':'🟢 Go online & share GPS'}</button>
          {online && <p className="fineprint">Habang online at bukas ang page, susubukan nitong mag-update ng lokasyon. Maaaring tumigil ang GPS kapag isinara o isinuspinde ng phone ang browser.</p>}
        </section>
        <section className="card"><div className="card-title"><div><h2>Booking requests</h2><p>Mga booking na puwedeng sagutin</p></div><span>🔔</span></div>
          {bookings.filter(b=>b.status==='requested').length===0 ? <p className="empty">Walang bagong booking sa ngayon.</p> : bookings.filter(b=>b.status==='requested').map(b=><div className="booking" key={b.id}><div className="route">{b.pickup_text} <span>→</span> {b.destination_text}</div><p className="fineprint">Estimated fare: {b.fare_estimate==null?'Pag-usapan':`₱${b.fare_estimate}`}</p><div className="row"><button className="btn primary" onClick={()=>respondBooking(b.id,'accepted')}>Tanggapin</button><button className="btn reject" onClick={()=>respondBooking(b.id,'rejected')}>Tanggihan</button></div></div>)}
        </section>
      </>}
      <section className="card safety"><h2>Kaligtasan at privacy</h2><p>Humingi ng pahintulot bago magbahagi ng GPS. Sa pilot, gamitin lamang ang app kasama ang mga driver at pasaherong pumayag. Huwag ilagay ang tunay na personal na impormasyon hangga't hindi nasusuri ang access rules at privacy notice.</p></section>
      {notice && <div className="notice" role="status"><span>{notice}</span><button onClick={()=>setNotice('')} aria-label="Close">×</button></div>}
    </main>
    <footer>🛺 <b>TODA GO</b> <span>Prototype · Cantilan Pilot</span></footer>
  </div>;
}