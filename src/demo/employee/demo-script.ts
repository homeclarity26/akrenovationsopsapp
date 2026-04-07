// 13-step employee demo walkthrough script

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
  | 'completion'

export interface DemoStep {
  step: number
  screen: DemoScreen
  title: string
  explanation: string
  action_label: string | null
  highlight: string | null
  is_ai_scene?: boolean
  ai_scene_type?: 'field_question' | 'change_order'
  suggested_prompt?: string
  ai_system_prompt?: string
  scene_description?: string
  show_ai_badge?: boolean
}

export const EMPLOYEE_DEMO_SCRIPT: DemoStep[] = [
  {
    step: 1,
    screen: 'welcome',
    title: 'Working at AK Renovations',
    explanation:
      "Before your interview, we want to show you exactly how we run our jobs. This takes about 5 minutes. No login needed — just tap through.",
    action_label: "Let's go",
    highlight: null,
  },
  {
    step: 2,
    screen: 'launchpad',
    title: 'Your home screen',
    explanation:
      "This is where your day starts. Everything you need is right here, one tap away. Adam knows where you are and what you're working on without having to call you.",
    action_label: 'Tap Schedule to see your day',
    highlight: 'schedule_card',
  },
  {
    step: 3,
    screen: 'schedule',
    title: "You always know what you're doing",
    explanation:
      "Adam schedules your day here. Henderson Kitchen in the morning, Carter Bathroom after lunch. The address, the task, the phase — all here before you leave the house.",
    action_label: 'Tap Time Clock to clock in',
    highlight: 'schedule_items',
  },
  {
    step: 4,
    screen: 'time_clock_project_select',
    title: 'Clocking in — pick your project',
    explanation:
      "Every clock-in is tied to a specific project. If you work two jobs in one day, which happens, you clock in and out for each one separately. No guessing, no paperwork at the end of the week.",
    action_label: 'Tap Henderson Kitchen',
    highlight: 'project_list',
  },
  {
    step: 5,
    screen: 'time_clock_work_type',
    title: 'What kind of work?',
    explanation:
      "Pick what you're doing. This matters because different work types are billed at different rates. Field carpentry runs at one rate, site visits at another. It tracks automatically.",
    action_label: 'Tap Field Carpentry',
    highlight: 'work_type_grid',
  },
  {
    step: 6,
    screen: 'time_clock_active',
    title: "You're clocked in",
    explanation:
      "GPS captured. Clock running. Adam can see you're on site. Clock out when you leave, it takes two taps.",
    action_label: 'Tap to snap a receipt',
    highlight: 'active_segment',
  },
  {
    step: 7,
    screen: 'receipt_scanner',
    title: 'Bought something for the job?',
    explanation:
      "Snap the receipt. That's it. The AI reads the vendor, amount, and items automatically. No filling out a form. No saving a photo and texting Adam. It files itself.",
    action_label: 'Tap to snap',
    highlight: 'camera_button',
  },
  {
    step: 8,
    screen: 'receipt_confirm',
    title: 'The AI read it',
    explanation:
      "Lowe's. $47.82. Cabinet screws, wood shims, thinset. All extracted automatically and assigned to Henderson Kitchen. Confirm and it's filed. Adam sees it instantly.",
    action_label: 'Confirm',
    highlight: 'extracted_data',
    show_ai_badge: true,
  },
  {
    step: 9,
    screen: 'shopping_list',
    title: 'Shopping list — with the supplier info built in',
    explanation:
      "Adam adds materials you need here. But notice, it tells you exactly where to go and gives you the account number. No more calling Adam to ask which store or if we have an account.",
    action_label: 'Continue',
    highlight: 'first_item_with_supplier',
  },
  {
    step: 10,
    screen: 'ai_scene_1',
    title: 'Ask the AI anything about your job',
    explanation:
      "The AI knows everything about your projects. Try asking it something. We've given you a suggestion, or type your own question.",
    action_label: null,
    highlight: 'ai_input',
    is_ai_scene: true,
    ai_scene_type: 'field_question',
    suggested_prompt:
      'What grout should I use for the Carter bathroom floor tile?',
    ai_system_prompt: `You are the AI assistant for AK Renovations, a high-end residential renovation contractor in Summit County, Ohio. You are talking to Marcus, a lead remodeler, through the field app on his phone.

The current project context:
- Carter Bathroom — Master Suite at 923 Elmhurst Ave, Hudson OH
- Phase: Tile Work — floor tile grouting
- Client selected: Mapei Warm Gray unsanded grout
- Floor tile: 12x24 porcelain, rectified edges, 1/16" grout joint
- Shower tile: 3x12 subway, already grouted with Mapei Warm Gray sanded

Answer field questions concisely and practically. You are a knowledgeable colleague, not a chatbot. Use specific product names, measurements, and techniques. Never be vague. Max 3-4 sentences unless a step-by-step is genuinely needed.`,
    scene_description:
      "The AI responds with exactly what Marcus needs — the right grout, the right technique, and a heads-up about the joint size. Not a Google search. Not a call to Adam. Just the answer.",
  },
  {
    step: 11,
    screen: 'photos',
    title: 'Photos — documented automatically',
    explanation:
      "Take a progress photo, pick the category, and it's filed to the right project. No texting photos. No albums to sort. Adam sees completed work in real time from anywhere.",
    action_label: 'Continue',
    highlight: 'category_picker',
  },
  {
    step: 12,
    screen: 'ai_scene_2',
    title: 'Found something unexpected on site',
    explanation:
      "You pull off a wall panel and find water damage that wasn't in the original scope. This happens. Here's how you handle it — tell the AI what you found.",
    action_label: null,
    highlight: 'ai_input',
    is_ai_scene: true,
    ai_scene_type: 'change_order',
    suggested_prompt:
      "I pulled the cabinet off the wall next to the sink and there's water damage on the drywall and the bottom plate looks rotted. It wasn't in the original scope.",
    ai_system_prompt: `You are the AI assistant for AK Renovations, a high-end residential renovation contractor in Summit County, Ohio. You are talking to Marcus, a lead remodeler, through the field app on his phone.

The current project context:
- Henderson Kitchen Remodel at 1847 Ridgewood Dr, Stow OH
- Phase: Cabinet Installation
- Original scope: Full kitchen remodel — demo, cabinets, countertops, backsplash, flooring, plumbing, electrical
- Contract value: not relevant to share with field staff
- Client: Tom & Dana Henderson

Marcus has just found unexpected water damage. Your job:
1. Acknowledge what he found
2. Tell him to take photos immediately (specific: the damage, the rotted plate, the extent of moisture)
3. Tell him not to proceed with cabinet install in that area yet
4. Tell him you're flagging this for Adam right now as a potential change order
5. Be calm and practical — this is normal in remodeling

Keep it under 5 sentences. Sound like a knowledgeable colleague, not a bot.`,
    scene_description:
      "The AI tells Marcus exactly what to do — take photos, don't proceed, Adam is being notified. A change order draft is automatically created. Adam sees it on his phone before Marcus even puts his away.",
  },
  {
    step: 13,
    screen: 'bonus_tracker',
    title: 'Your bonus tracker',
    explanation:
      "Every project completed on time and on budget earns you a bonus. No guessing. No waiting to ask Adam. Henderson Kitchen completes June 28 — that's a $900 bonus. It tracks itself.",
    action_label: 'Finish the walkthrough',
    highlight: 'bonus_card',
  },
]

export const EMPLOYEE_AI_FALLBACKS: Record<'field_question' | 'change_order', string> = {
  field_question:
    "Use Mapei Ultracolor Plus FA in Warm Gray, unsanded — Rachel selected that to match the shower. With your 1/16\" joint on the 12x24 porcelain, mix it slightly looser than the bag instructions and work in 3-foot sections so it doesn't skin over. Wipe at a 45-degree angle so you don't pull grout out of the joints.",
  change_order:
    "Good catch. Stop work in that area immediately — don't reset the cabinet. Take three photos right now: the damaged drywall, the bottom plate, and a wide shot of the extent. I'm flagging this for Adam as a potential change order now and he'll see it on his phone within seconds. This is normal on older homes; we'll get it priced and approved before you do any more work there.",
}
