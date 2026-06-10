import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Overview } from "./pages/Overview";
import { Conversations } from "./pages/Conversations";
import { Playground } from "./pages/Playground";
import { Appointments } from "./pages/Appointments";
import { Settings } from "./pages/Settings";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Overview />} />
          <Route path="/conversas" element={<Conversations />} />
          <Route path="/playground" element={<Playground />} />
          <Route path="/agenda" element={<Appointments />} />
          <Route path="/configuracoes" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
