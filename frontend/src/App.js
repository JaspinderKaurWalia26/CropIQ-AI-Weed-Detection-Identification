import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './App.css';
import AboutUs from './user/pages/Aboutus';
import Login from './user/pages/login';
import Signup from './user/pages/signup';
import Dashboard from './user/pages/dashboard';
import ScanWeeds from './user/pages/ScanWeeds';
import UploadImage from './user/pages/UploadImage';
import ScanHistory from './user/pages/ScanHistory';
import EditProfile from './user/pages/EditProfile';
import CameraTest from './user/pages/CameraTest';
import LiveCapture from './user/pages/LiveCapture';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Landing page */}
        <Route path="/" element={<AboutUs />} />

        {/* Authentication pages */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        {/* Dashboard */}
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/dashboard/edit-profile" element={<EditProfile />} />

        {/* Other pages */}
        <Route path="/scanweeds" element={<ScanWeeds />} />
        <Route path="/uploadimage" element={<UploadImage />} />
        <Route path="/scanhistory" element={<ScanHistory />} />
        {/* Temporary: Camera test page */}
        <Route path="/camera-test" element={<CameraTest />} />
        {/* Live capture page */}
        <Route path="/live-capture" element={<LiveCapture />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
