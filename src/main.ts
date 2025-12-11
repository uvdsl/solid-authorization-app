import { createApp } from 'vue'
import App from './App.vue'

import "./registerServiceWorker";

import PrimeVue from 'primevue/config';
import Aura from '@primevue/themes/aura';
import "primeicons/primeicons.css";
import 'primeflex/primeflex.css';

import Button from "primevue/button";
import SelectButton from 'primevue/selectbutton';
import Checkbox from 'primevue/checkbox';
import InputText from 'primevue/inputtext';
import Divider from 'primevue/divider';
import Dialog from 'primevue/dialog';
import Card from 'primevue/card';
import Chip from 'primevue/chip';
import Panel from 'primevue/panel';
import Skeleton from 'primevue/skeleton';
import Avatar from 'primevue/avatar';
import Accordion from 'primevue/accordion';
import AccordionPanel from 'primevue/accordionpanel';
import AccordionHeader from 'primevue/accordionheader';
import AccordionContent from 'primevue/accordioncontent';
import Fieldset from 'primevue/fieldset';

import Badge from 'primevue/badge';
import OverlayBadge from 'primevue/overlaybadge';

import Toast from 'primevue/toast';
import ToastService from 'primevue/toastservice';

import ConfirmDialog from 'primevue/confirmdialog';
import ConfirmationService from 'primevue/confirmationservice';

import Tooltip from 'primevue/tooltip';

import { definePreset } from '@primevue/themes';

const app = createApp(App);

const SolidAura = definePreset(Aura, {
    semantic: {
        primary: {
            50: '{violet.50}',
            100: '{violet.100}',
            200: '{violet.200}',
            300: '{violet.300}',
            400: '{violet.400}',
            500: '{violet.500}',
            600: '{violet.600}',
            700: '{violet.700}',
            800: '{violet.800}',
            900: '{violet.900}',
            950: '{violet.950}'
        },
        surface: {
            50: '{zinc.50}',
            100: '{zinc.100}',
            200: '{zinc.200}',
            300: '{zinc.300}',
            400: '{zinc.400}',
            500: '{zinc.500}',
            600: '{zinc.600}',
            700: '{zinc.700}',
            800: '{zinc.800}',
            900: '{zinc.900}',
            950: '{zinc.950}'
        }
    }
});

app.use(PrimeVue, {
    theme: {
        preset: SolidAura,
    }
});
app.component('Button', Button);
app.component('SelectButton', SelectButton);
app.component('Checkbox', Checkbox);
app.component('InputText', InputText);
app.component('Divider', Divider);
app.component('Dialog', Dialog);
app.component('Card', Card);
app.component('Chip', Chip);
app.component('Panel', Panel);
app.component('Skeleton', Skeleton);
app.component('Avatar', Avatar);
app.component('Accordion', Accordion);
app.component('AccordionPanel', AccordionPanel);
app.component('AccordionHeader', AccordionHeader);
app.component('AccordionContent', AccordionContent);
app.component('Fieldset', Fieldset);

app.component('Badge',Badge);
app.component('OverlayBadge',OverlayBadge);


app.component('Toast', Toast);
app.use(ToastService);

app.component('ConfirmDialog', ConfirmDialog);
app.use(ConfirmationService);


app.directive('tooltip', Tooltip);

app.mount('#app')