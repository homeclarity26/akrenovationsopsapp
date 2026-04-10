// 13-step employee demo walkthrough script.
//
// Narration style: short, conversational, explain what the screen IS and
// why it matters. No "Tap X" instructions — the only action the user takes
// is the always-visible Next button in the footer (label chosen by shell).
// Keep each explanation under ~280 characters so the footer stays tidy on
// small screens.

export type DemoScreen =
  | 'welcome'
  | 'launchpad'
  | 'schedule'
  | 'time_clock_project_select'
  | 'time_clock_work_type'
  | 'time_clock_active'
  | 'receipt_scanner'
  | 'receipt_confirm'
  | 'shopping_list'
  | 'ai_scene_1'
  | 'photos'
  | 'ai_scene_2'
  | 'bonus_tracker'

export interface DemoStep {
  step: number
  screen: DemoScreen
  title: string
  explanation: string
  highlight: string | null
  is_ai_scene?: boolean
  ai_scene_type?: 'field_question' | 'change_order'
  suggested_prompt?: string
  ai_system_prompt?: string
  scene_description?: string
}

export const EMPLOYEE_DEMO_SCRIPT: DemoStep[] = [
  {
    step: 1,
    screen: 'welcome',
    title: 'Working with TradeOffice AI',
    explanation:
      "This is a 5-minute look at how we run our jobs. Tap Next or press Space to move through it at your own pace.",
    highlight: null,
  },
  {
    step: 2,
    screen: 'launchpad',
    title: 'Your home screen',
    explanation:
      "Every tool you need on one screen. No menus to dig through. Adam knows where you are and what you're working on without having to call you.",
    highlight: 'schedule_card',
  },
  {
    step: 3,
    screen: 'schedule',
    title: "You always know what you're doing",
    explanation:
      "Adam lays out your day in the office. Henderson Kitchen in the morning, Carter Bathroom after lunch. Address, task, phase — all before you leave the house.",
    highlight: 'schedule_items',
  },
  {
    step: 4,
    screen: 'time_clock_project_select',
    title: 'Clocking in — pick the project',
    explanation:
      "Every clock-in is tied to a specific project. Work two jobs in one day? You clock in and out for each one separately. No guessing at the end of the week.",
    highlight: 'project_list',
  },
  {
    step: 5,
    screen: 'time_clock_work_type',
    title: 'What kind of work?',
    explanation:
      "Field carpentry? Site visit? Travel? Each one has its own billing rate. Pick once and it tracks automatically for the rest of that session.",
    highlight: 'work_type_grid',
  },
  {
    step: 6,
    screen: 'time_clock_active',
    title: "You're clocked in",
    explanation:
      "GPS captured, clock running, Adam can see you're on site. When you leave, clock out takes two taps. If you forget, you can add a manual entry later.",
    highlight: 'active_segment',
  },
  {
    step: 7,
    screen: 'receipt_scanner',
    title: 'Bought something for the job?',
    explanation:
      "Snap the receipt. That's the whole action. No forms. No texting photos to Adam. The AI reads it for you — you'll see next.",
    highlight: 'camera_button',
  },
  {
    step: 8,
    screen: 'receipt_confirm',
    title: 'The AI read it',
    explanation:
      "Lowe's. $47.82. Cabinet screws, wood shims, thinset. Assigned to Henderson Kitchen automatically. You confirm, it files itself. Adam sees it instantly.",
    highlight: 'extracted_data',
  },
  {
    step: 9,
    screen: 'shopping_list',
    title: 'Shopping list — with the supplier info built in',
    explanation:
      "Adam adds what you need. But notice — each item tells you exactly which store and gives you the account number. No calling to ask where to go.",
    highlight: 'first_item_with_supplier',
  },
  {
    step: 10,
    screen: 'ai_scene_1',
    title: 'Ask the AI anything about your job',
    explanation:
      "Try it: type a question or use the suggestion. The AI knows your projects, your clients, your selections. Or press Skip to keep moving.",
    highlight: 'ai_input',
    is_ai_scene: true,
    ai_scene_type: 'field_question',
    suggested_prompt:
      'What grout should I use for the Carter bathroom floor tile?',
    ai_system_prompt: `You are the AI assistant for AK Renovations, a high-end residential renovation contractor in Summit County, Ohio. You are talking to Jeff, a lead remodeler, through the field app on his phone.

The current project context:
- Carter Bathroom — Master Suite at 923 Elmhurst Ave, Hudson OH
- Phase: Tile Work — floor tile grouting
- Client selected: Mapei Warm Gray unsanded grout
- Floor tile: 12x24 porcelain, rectified edges, 1/16" grout joint
- Shower tile: 3x12 subway, already grouted with Mapei Warm Gray sanded

Answer field questions concisely and practically. You are a knowledgeable colleague, not a chatbot. Use specific product names, measurements, and techniques. Never be vague. Max 3-4 sentences unless a step-by-step is genuinely needed.`,
    scene_description:
      "The AI gives Jeff exactly what he needs — right grout, right technique, note about joint size. Not a Google search. Not a call to Adam.",
  },
  {
    step: 11,
    screen: 'photos',
    title: 'Photos, documented automatically',
    explanation:
      "Take a progress photo, pick the category, it's filed to the right project. No texting. No albums to sort. Adam sees completed work in real time.",
    highlight: 'category_picker',
  },
  {
    step: 12,
    screen: 'ai_scene_2',
    title: 'Found something unexpected on site',
    explanation:
      "Pull off a panel, find water damage, it's not in the scope. This happens. Here's how you handle it — try the AI or Skip to see the finish.",
    highlight: 'ai_input',
    is_ai_scene: true,
    ai_scene_type: 'change_order',
    suggested_prompt:
      "I pulled the cabinet off the wall next to the sink and there's water damage on the drywall and the bottom plate looks rotted. It wasn't in the original scope.",
    ai_system_prompt: `You are the AI assistant for AK Renovations, a high-end residential renovation contractor in Summit County, Ohio. You are talking to Jeff, a lead remodeler, through the field app on his phone.

The current project context:
- Henderson Kitchen Remodel at 1847 Ridgewood Dr, Stow OH
- Phase: Cabinet Installation
- Original scope: Full kitchen remodel — demo, cabinets, countertops, backsplash, flooring, plumbing, electrical
- Client: Tom & Dana Henderson

Jeff has just found unexpected water damage. Your job:
1. Acknowledge what he found
2. Tell him to take photos immediately (specific: the damage, the rotted plate, the extent of moisture)
3. Tell him not to proceed with cabinet install in that area yet
4. Tell him you're flagging this for Adam right now as a potential change order
5. Be calm and practical — this is normal in remodeling

Keep it under 5 sentences. Sound like a knowledgeable colleague, not a bot.`,
    scene_description:
      "The AI tells Jeff what to do — take photos, don't proceed, Adam is being notified. A change order draft is automatically created and Adam sees it before Jeff puts his phone away.",
  },
  {
    step: 13,
    screen: 'bonus_tracker',
    title: 'Your bonus tracker',
    explanation:
      "Every project completed on time and on budget earns a bonus. Henderson Kitchen wraps June 28 — that's a $900 bonus, tracked automatically. No chasing.",
    highlight: 'bonus_card',
  },
]

export const EMPLOYEE_AI_FALLBACKS: Record<'field_question' | 'change_order', string> = {
  field_question:
    "Use Mapei Ultracolor Plus FA in Warm Gray, unsanded — Rachel selected that to match the shower. With your 1/16\" joint on the 12x24 porcelain, mix it slightly looser than the bag instructions and work in 3-foot sections so it doesn't skin over. Wipe at a 45-degree angle so you don't pull grout out of the joints.",
  change_order:
    "Good catch. Stop work in that area immediately — don't reset the cabinet. Take three photos right now: the damaged drywall, the bottom plate, and a wide shot of the extent. I'm flagging this for Adam as a potential change order now and he'll see it on his phone within seconds. This is normal on older homes; we'll get it priced and approved before you do any more work there.",
}
