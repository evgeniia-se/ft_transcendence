//Owner: Track 4 (Whiteboard, notes, and supporting modules)
//Responsible for: the Privacy Policy page — mandatory, non-placeholder, reachable via footer link per the general requirements.

import type { LegalSection, LegalVersions } from "./legalDoc";

const SECTIONS_EN: LegalSection[] = [
	{
		title: "1. Who we are",
		paragraphs: [
			"ft_transcendence is a student project built at 42 Paris by the students listed in the repository README. It is not a company and not a commercial service. It exists so we can learn, and so our school can grade our work.",
			"Whoever runs a copy of this application is the data controller for the data stored in it. If you are using an instance hosted by someone else, contact that person.",
		],
	},
	{
		title: "2. What we collect",
		paragraphs: [
			"Account data: your email address and your display name. If you sign up with a password, we store a salted scrypt hash of it, never the password itself. You may also upload a profile picture as PNG, JPEG, GIF or WebP; it is stored on our server and is reachable by anyone who has its address, which is a random identifier.",
			"GitHub sign-in: if you sign in with GitHub, we receive your GitHub account identifier, your public profile name, your primary email address and your avatar URL. Your GitHub picture is used as your profile picture until you upload your own. We also store the GitHub access token GitHub gives us, encrypted with AES-256-GCM. The token is requested with the scopes read:user, user:email and repo, and it is only used to list the branches of a repository and to create a branch when you link a card to Git.",
			"Content you create: projects, boards, lists, cards, tags, notes, folders, whiteboards and the files you upload. For each item we record who created it or last changed it, and when. Uploaded files are limited to 10 MB and to images, PDF, plain text, Markdown, JSON and ZIP files.",
			"Activity data: the notifications generated for you, the invitation links you create or use, the API keys you generate (only a hash of each key is stored) and the Git branches you link to cards.",
			"GitHub webhooks: when a repository is linked to a project, GitHub sends us events about pushes and pull requests on that repository. We store each event, including its content such as branch names, commit messages and the GitHub usernames involved, so cards can move automatically and so problems can be investigated.",
			"Technical data: ordinary server logs, which include your IP address, the page or endpoint requested and the time. We keep these to debug problems and to notice abuse.",
		],
	},
	{
		title: "3. Why we collect it",
		paragraphs: [
			"Only to make the application work: to sign you in, to show you your projects, to let your teammates see what you wrote, to link cards to Git branches, and to notify you when something changes.",
			"We do not sell your data. We do not share it with advertisers. There is no analytics, no advertising and no tracking of any kind in this application.",
		],
	},
	{
		title: "4. Legal basis (GDPR)",
		paragraphs: [
			"For your account and the content you create, our legal basis is performance of a contract: we cannot provide the service without storing them.",
			"For GitHub sign-in and Git integration, our legal basis is your consent, which you give when you authorize the application on GitHub. You can withdraw it at any time from your GitHub settings.",
			"For server logs and security measures, our legal basis is legitimate interest in keeping the service working and protecting it from abuse.",
		],
	},
	{
		title: "5. Who can see your data",
		paragraphs: [
			"Other members of a project can see the content of that project, including notes, cards, files, and the name attached to each change. They can also see your name and email address in the member list. If you do not want someone to see something, do not put it in a project they belong to.",
			"Nobody outside your projects can see your content. Files can only be downloaded by signed-in members of their project.",
			"We do not send your data to any third party, with one exception: GitHub. If you sign in with GitHub or link a card to a repository, requests are exchanged with GitHub. GitHub has its own privacy policy.",
		],
	},
	{
		title: "6. Where it is stored and for how long",
		paragraphs: [
			"All data is stored in a PostgreSQL database on the machine running the application. Uploaded files are stored on that machine's disk. Nothing is stored anywhere else.",
			"Your data is kept for as long as your account exists. Content you delete yourself is removed right away. Server logs are short-lived and are overwritten as the service runs.",
		],
	},
	{
		title: "7. Your rights",
		paragraphs: [
			"You can see your account information in your settings at any time, and change your display name, your profile picture and your password there. Your email address cannot be edited from the application yet: to correct it, or to get a copy of your data, contact the team running the instance and we will do it for you.",
			"You can delete your account from your settings. When you do, your account row is deleted: your email, your name, your profile picture file, your password hash and your GitHub link and token are erased. Your notifications and your API keys are permanently deleted.",
			"Content you created inside a shared project stays in that project so that your teammates' work is not broken by your departure. If you own a project that has other members, you choose which member it is transferred to before your account is deleted; if you are the only member, the project and everything in it is deleted with your account.",
			"You also have the right to object, to restrict processing and to complain to a data protection authority. In France, that is the CNIL at www.cnil.fr.",
		],
	},
	{
		title: "8. Security",
		paragraphs: [
			"Passwords are hashed with scrypt and a per-user salt. Sessions use signed tokens that expire after 24 hours. GitHub tokens are encrypted at rest. API keys and invitation links are stored as hashes. GitHub webhooks are checked with an HMAC signature.",
			"Traffic between your browser and the server is encrypted with HTTPS.",
			"This is a student project. We have done our best, but we cannot promise the security of a professional service. Please do not store anything genuinely sensitive here.",
		],
	},
	{
		title: "9. Cookies and browser storage",
		paragraphs: [
			"We use no cookies. We store a few things in your browser's local storage: the token that keeps you signed in and a copy of your name and email for display, your light or dark theme choice, your interface language, and the last repository address you typed when linking a card to Git. Signing out removes the token and the copy of your profile. Clearing your browser data removes everything.",
			"We use no advertising cookies, no analytics and no third-party trackers.",
		],
	},
	{
		title: "10. Children",
		paragraphs: [
			"This service is not intended for anyone under 15, the age of digital consent in France. We do not knowingly collect data from children.",
		],
	},
	{
		title: "11. Changes to this policy",
		paragraphs: [
			"If we change how the application handles data, we will update this page and change the date at the top.",
		],
	},
	{
		title: "12. Contact",
		paragraphs: [
			"Questions about your data can be sent to the team that runs this instance. For the original project, that is the 42 Paris students listed in the repository README.",
		],
	},
];

const SECTIONS_FR: LegalSection[] = [
	{
		title: "1. Qui nous sommes",
		paragraphs: [
			"ft_transcendence est un projet étudiant réalisé à 42 Paris par les étudiants listés dans le README du dépôt. Ce n'est ni une entreprise ni un service commercial. Il existe pour que nous apprenions, et pour que notre école puisse évaluer notre travail.",
			"La personne qui fait fonctionner une copie de cette application est responsable du traitement des données qui y sont stockées. Si vous utilisez une instance hébergée par quelqu'un d'autre, contactez cette personne.",
		],
	},
	{
		title: "2. Ce que nous collectons",
		paragraphs: [
			"Données de compte : votre adresse e-mail et votre nom affiché. Si vous vous inscrivez avec un mot de passe, nous en stockons une empreinte scrypt salée, jamais le mot de passe lui-même. Vous pouvez aussi envoyer une photo de profil en PNG, JPEG, GIF ou WebP ; elle est stockée sur notre serveur et accessible à quiconque connaît son adresse, qui est un identifiant aléatoire.",
			"Connexion GitHub : si vous vous connectez avec GitHub, nous recevons l'identifiant de votre compte GitHub, le nom de votre profil public, votre adresse e-mail principale et l'adresse de votre avatar. Votre photo GitHub sert de photo de profil tant que vous n'en envoyez pas une. Nous stockons aussi le jeton d'accès fourni par GitHub, chiffré en AES-256-GCM. Ce jeton est demandé avec les autorisations read:user, user:email et repo, et sert uniquement à lister les branches d'un dépôt et à créer une branche quand vous liez une carte à Git.",
			"Contenu que vous créez : projets, tableaux, listes, cartes, étiquettes, notes, dossiers, tableaux blancs et fichiers envoyés. Pour chaque élément, nous enregistrons qui l'a créé ou modifié en dernier, et quand. Les fichiers envoyés sont limités à 10 Mo et aux images, PDF, textes, Markdown, JSON et ZIP.",
			"Données d'activité : les notifications générées pour vous, les liens d'invitation que vous créez ou utilisez, les clés API que vous générez (seule une empreinte de chaque clé est stockée) et les branches Git que vous liez aux cartes.",
			"Webhooks GitHub : quand un dépôt est lié à un projet, GitHub nous envoie des événements sur les pushes et pull requests de ce dépôt. Nous stockons chaque événement, y compris son contenu (noms de branches, messages de commit, noms d'utilisateurs GitHub concernés), pour que les cartes avancent automatiquement et pour pouvoir analyser les problèmes.",
			"Données techniques : les journaux habituels du serveur, qui contiennent votre adresse IP, la page ou la route demandée et l'heure. Nous les gardons pour corriger les problèmes et repérer les abus.",
		],
	},
	{
		title: "3. Pourquoi nous les collectons",
		paragraphs: [
			"Uniquement pour faire fonctionner l'application : vous connecter, vous montrer vos projets, permettre à vos coéquipiers de voir ce que vous avez écrit, lier des cartes à des branches Git, et vous prévenir quand quelque chose change.",
			"Nous ne vendons pas vos données. Nous ne les partageons pas avec des annonceurs. Il n'y a ni mesure d'audience, ni publicité, ni pistage d'aucune sorte dans cette application.",
		],
	},
	{
		title: "4. Base légale (RGPD)",
		paragraphs: [
			"Pour votre compte et le contenu que vous créez, la base légale est l'exécution d'un contrat : nous ne pouvons pas fournir le service sans les stocker.",
			"Pour la connexion GitHub et l'intégration Git, la base légale est votre consentement, que vous donnez en autorisant l'application sur GitHub. Vous pouvez le retirer à tout moment depuis vos réglages GitHub.",
			"Pour les journaux du serveur et les mesures de sécurité, la base légale est l'intérêt légitime à faire fonctionner le service et à le protéger des abus.",
		],
	},
	{
		title: "5. Qui peut voir vos données",
		paragraphs: [
			"Les autres membres d'un projet voient le contenu de ce projet, y compris les notes, cartes, fichiers et le nom associé à chaque modification. Ils voient aussi votre nom et votre adresse e-mail dans la liste des membres. Si vous ne voulez pas que quelqu'un voie quelque chose, ne le mettez pas dans un projet dont il fait partie.",
			"Personne en dehors de vos projets ne voit votre contenu. Les fichiers ne peuvent être téléchargés que par les membres connectés de leur projet.",
			"Nous n'envoyons vos données à aucun tiers, à une exception près : GitHub. Si vous vous connectez avec GitHub ou liez une carte à un dépôt, des requêtes sont échangées avec GitHub, qui a sa propre politique de confidentialité.",
		],
	},
	{
		title: "6. Où elles sont stockées et combien de temps",
		paragraphs: [
			"Toutes les données sont stockées dans une base PostgreSQL sur la machine qui fait tourner l'application. Les fichiers envoyés sont stockés sur le disque de cette machine. Rien n'est stocké ailleurs.",
			"Vos données sont conservées tant que votre compte existe. Le contenu que vous supprimez vous-même est effacé immédiatement. Les journaux du serveur ont une durée de vie courte et sont écrasés au fil du fonctionnement du service.",
		],
	},
	{
		title: "7. Vos droits",
		paragraphs: [
			"Vous pouvez consulter les informations de votre compte à tout moment dans vos paramètres, et y modifier votre nom affiché, votre photo de profil et votre mot de passe. Votre adresse e-mail ne peut pas encore être modifiée depuis l'application : pour la corriger, ou pour obtenir une copie de vos données, contactez l'équipe qui gère l'instance et nous le ferons pour vous.",
			"Vous pouvez supprimer votre compte depuis vos paramètres. Votre compte est alors supprimé : votre e-mail, votre nom, votre photo de profil, l'empreinte de votre mot de passe ainsi que votre lien et votre jeton GitHub sont effacés. Vos notifications et vos clés API sont supprimées définitivement.",
			"Le contenu que vous avez créé dans un projet partagé reste dans ce projet, pour que le travail de vos coéquipiers ne soit pas cassé par votre départ. Si vous êtes propriétaire d'un projet qui a d'autres membres, vous choisissez à quel membre il est transféré avant la suppression de votre compte ; si vous en êtes le seul membre, le projet et tout son contenu sont supprimés avec votre compte.",
			"Vous avez aussi le droit de vous opposer au traitement, d'en demander la limitation et de porter réclamation auprès d'une autorité de protection des données. En France, c'est la CNIL : www.cnil.fr.",
		],
	},
	{
		title: "8. Sécurité",
		paragraphs: [
			"Les mots de passe sont hachés avec scrypt et un sel propre à chaque utilisateur. Les sessions utilisent des jetons signés qui expirent au bout de 24 heures. Les jetons GitHub sont chiffrés au repos. Les clés API et les liens d'invitation sont stockés sous forme d'empreintes. Les webhooks GitHub sont vérifiés par une signature HMAC.",
			"Les échanges entre votre navigateur et le serveur sont chiffrés en HTTPS.",
			"C'est un projet étudiant. Nous avons fait de notre mieux, mais nous ne pouvons pas promettre la sécurité d'un service professionnel. Merci de ne rien stocker de vraiment sensible ici.",
		],
	},
	{
		title: "9. Cookies et stockage du navigateur",
		paragraphs: [
			"Nous n'utilisons aucun cookie. Nous stockons quelques éléments dans le stockage local de votre navigateur : le jeton qui vous garde connecté et une copie de votre nom et de votre e-mail pour l'affichage, votre choix de thème clair ou sombre, la langue de l'interface, et la dernière adresse de dépôt saisie pour lier une carte à Git. La déconnexion efface le jeton et la copie de votre profil. Effacer les données de votre navigateur efface tout.",
			"Nous n'utilisons ni cookies publicitaires, ni mesure d'audience, ni traceurs tiers.",
		],
	},
	{
		title: "10. Enfants",
		paragraphs: [
			"Ce service n'est pas destiné aux moins de 15 ans, l'âge de la majorité numérique en France. Nous ne collectons pas sciemment de données concernant des enfants.",
		],
	},
	{
		title: "11. Modification de cette politique",
		paragraphs: [
			"Si nous changeons la façon dont l'application traite les données, nous mettrons cette page à jour et changerons la date en haut.",
		],
	},
	{
		title: "12. Contact",
		paragraphs: [
			"Les questions sur vos données peuvent être adressées à l'équipe qui gère cette instance. Pour le projet d'origine, ce sont les étudiants de 42 Paris listés dans le README du dépôt.",
		],
	},
];

const SECTIONS_JA: LegalSection[] = [
	{
		title: "1. 私たちについて",
		paragraphs: [
			"ft_transcendence は、リポジトリの README に記載された学生が 42 Paris で作成した学生プロジェクトです。企業でも商用サービスでもありません。私たちが学び、学校が私たちの成果を評価するために存在しています。",
			"このアプリケーションのコピーを運営する人が、そこに保存されたデータの管理者となります。他の人がホストするインスタンスを利用している場合は、その人に連絡してください。",
		],
	},
	{
		title: "2. 収集する情報",
		paragraphs: [
			"アカウント情報：メールアドレスと表示名。パスワードで登録した場合は、パスワードそのものではなく、ソルト付きの scrypt ハッシュを保存します。PNG、JPEG、GIF、WebP のプロフィール写真をアップロードすることもできます。写真はサーバーに保存され、ランダムな識別子であるそのアドレスを知っている人なら誰でもアクセスできます。",
			"GitHub ログイン：GitHub でログインすると、GitHub アカウントの識別子、公開プロフィール名、メインのメールアドレス、アバターの URL を受け取ります。GitHub の写真は、ご自身の写真をアップロードするまでプロフィール写真として使われます。また、GitHub から渡されるアクセストークンを AES-256-GCM で暗号化して保存します。このトークンは read:user、user:email、repo のスコープで要求され、リポジトリのブランチ一覧の取得と、カードを Git に紐づける際のブランチ作成にのみ使われます。",
			"あなたが作成するコンテンツ：プロジェクト、ボード、リスト、カード、タグ、ノート、フォルダー、ホワイトボード、アップロードしたファイル。各項目について、誰がいつ作成または最後に変更したかを記録します。アップロードできるファイルは 10 MB までで、画像、PDF、プレーンテキスト、Markdown、JSON、ZIP に限られます。",
			"活動データ：あなた宛てに生成された通知、あなたが作成または使用した招待リンク、あなたが生成した API キー（各キーのハッシュのみ保存）、カードに紐づけた Git ブランチ。",
			"GitHub Webhook：リポジトリがプロジェクトに紐づいていると、GitHub はそのリポジトリのプッシュやプルリクエストに関するイベントを送ってきます。カードを自動で進めたり、問題を調査したりするために、ブランチ名、コミットメッセージ、関係する GitHub ユーザー名などの内容を含め、各イベントを保存します。",
			"技術データ：通常のサーバーログ。IP アドレス、要求されたページやエンドポイント、時刻が含まれます。問題のデバッグと不正利用の検知のために保持します。",
		],
	},
	{
		title: "3. 収集する目的",
		paragraphs: [
			"アプリケーションを動かすためだけに使います：ログイン、プロジェクトの表示、あなたが書いたものをチームメイトに見せること、カードと Git ブランチの紐づけ、変更があったときの通知。",
			"あなたのデータを販売することはありません。広告主と共有することもありません。このアプリケーションには、アクセス解析、広告、トラッキングは一切ありません。",
		],
	},
	{
		title: "4. 法的根拠（GDPR）",
		paragraphs: [
			"アカウントとあなたが作成するコンテンツについては、契約の履行が法的根拠です。これらを保存しなければサービスを提供できません。",
			"GitHub ログインと Git 連携については、GitHub でアプリケーションを認可する際にあなたが与える同意が法的根拠です。同意は GitHub の設定からいつでも撤回できます。",
			"サーバーログとセキュリティ対策については、サービスを稼働させ不正利用から守るという正当な利益が法的根拠です。",
		],
	},
	{
		title: "5. データを見られる人",
		paragraphs: [
			"プロジェクトの他のメンバーは、ノート、カード、ファイル、各変更に付けられた名前など、そのプロジェクトのコンテンツを見ることができます。メンバー一覧では、あなたの名前とメールアドレスも見えます。見られたくないものは、その人が参加しているプロジェクトに置かないでください。",
			"あなたのプロジェクトの外部の人は、あなたのコンテンツを見ることができません。ファイルをダウンロードできるのは、そのプロジェクトのログイン中のメンバーだけです。",
			"あなたのデータを第三者に送ることはありませんが、例外が 1 つあります：GitHub です。GitHub でログインしたりカードをリポジトリに紐づけたりすると、GitHub とリクエストがやり取りされます。GitHub には独自のプライバシーポリシーがあります。",
		],
	},
	{
		title: "6. 保存場所と保存期間",
		paragraphs: [
			"すべてのデータは、アプリケーションを動かしているマシン上の PostgreSQL データベースに保存されます。アップロードされたファイルはそのマシンのディスクに保存されます。それ以外の場所には何も保存されません。",
			"データはアカウントが存在する限り保持されます。ご自身で削除したコンテンツはすぐに削除されます。サーバーログは短期間しか残らず、サービスの稼働に伴って上書きされます。",
		],
	},
	{
		title: "7. あなたの権利",
		paragraphs: [
			"アカウント情報は設定でいつでも確認でき、表示名、プロフィール写真、パスワードを変更できます。メールアドレスはまだアプリケーションから変更できません。修正したい場合やデータのコピーが必要な場合は、インスタンスを運営するチームに連絡してください。対応します。",
			"設定からアカウントを削除できます。削除すると、アカウントの行が削除されます：メールアドレス、名前、プロフィール写真のファイル、パスワードのハッシュ、GitHub との紐づけとトークンが消去されます。通知と API キーは完全に削除されます。",
			"共有プロジェクト内で作成したコンテンツは、あなたが抜けてもチームメイトの作業が壊れないよう、そのプロジェクトに残ります。他のメンバーがいるプロジェクトのオーナーである場合は、アカウントを削除する前に、どのメンバーに移譲するかを選びます。唯一のメンバーである場合は、プロジェクトとその中身すべてがアカウントとともに削除されます。",
			"また、処理への異議、処理の制限を求める権利、データ保護機関に苦情を申し立てる権利があります。フランスでは CNIL（www.cnil.fr）です。",
		],
	},
	{
		title: "8. セキュリティ",
		paragraphs: [
			"パスワードは scrypt とユーザーごとのソルトでハッシュ化されます。セッションには 24 時間で期限切れになる署名付きトークンを使います。GitHub トークンは保存時に暗号化されます。API キーと招待リンクはハッシュとして保存されます。GitHub Webhook は HMAC 署名で検証されます。",
			"ブラウザとサーバー間の通信は HTTPS で暗号化されます。",
			"これは学生プロジェクトです。最善を尽くしていますが、プロのサービスと同等のセキュリティは約束できません。本当に機密性の高いものはここに保存しないでください。",
		],
	},
	{
		title: "9. Cookie とブラウザのストレージ",
		paragraphs: [
			"Cookie は使用していません。ブラウザのローカルストレージにいくつかの情報を保存します：ログイン状態を保つトークンと表示用の名前とメールアドレスのコピー、ライト／ダークテーマの選択、インターフェースの言語、カードを Git に紐づける際に最後に入力したリポジトリのアドレス。ログアウトするとトークンとプロフィールのコピーが削除されます。ブラウザのデータを消去すると、すべて削除されます。",
			"広告用 Cookie、アクセス解析、第三者のトラッカーは使用していません。",
		],
	},
	{
		title: "10. 子ども",
		paragraphs: [
			"本サービスは、フランスにおけるデジタル同意年齢である 15 歳未満の方を対象としていません。子どものデータを故意に収集することはありません。",
		],
	},
	{
		title: "11. 本ポリシーの変更",
		paragraphs: [
			"アプリケーションでのデータの扱い方を変更した場合は、このページを更新し、上部の日付を変更します。",
		],
	},
	{
		title: "12. お問い合わせ",
		paragraphs: [
			"データに関するご質問は、このインスタンスを運営するチームにお送りください。元のプロジェクトについては、リポジトリの README に記載された 42 Paris の学生です。",
		],
	},
];

const SECTIONS_RU: LegalSection[] = [
	{
		title: "1. Кто мы",
		paragraphs: [
			"ft_transcendence — студенческий проект, созданный в 42 Paris студентами, перечисленными в README репозитория. Это не компания и не коммерческий сервис. Он существует, чтобы мы учились и чтобы наша школа могла оценить нашу работу.",
			"Тот, кто запускает копию этого приложения, является оператором данных, хранящихся в ней. Если вы пользуетесь сервером, который размещает кто-то другой, обращайтесь к этому человеку.",
		],
	},
	{
		title: "2. Что мы собираем",
		paragraphs: [
			"Данные аккаунта: ваш адрес электронной почты и отображаемое имя. Если вы регистрируетесь с паролем, мы храним его хеш scrypt с солью, но никогда не сам пароль. Вы также можете загрузить фото профиля в формате PNG, JPEG, GIF или WebP; оно хранится на нашем сервере и доступно любому, кто знает его адрес — случайный идентификатор.",
			"Вход через GitHub: если вы входите через GitHub, мы получаем идентификатор вашего аккаунта GitHub, имя публичного профиля, основной адрес электронной почты и адрес аватара. Фото из GitHub используется как фото профиля, пока вы не загрузите своё. Мы также храним токен доступа, который выдаёт GitHub, в зашифрованном виде (AES-256-GCM). Токен запрашивается с правами read:user, user:email и repo и используется только для получения списка веток репозитория и создания ветки, когда вы связываете карточку с Git.",
			"Создаваемый вами контент: проекты, доски, списки, карточки, метки, заметки, папки, интерактивные доски и загруженные файлы. Для каждого элемента мы записываем, кто и когда его создал или последним изменил. Загружаемые файлы ограничены размером 10 МБ и типами: изображения, PDF, простой текст, Markdown, JSON и ZIP.",
			"Данные об активности: уведомления, созданные для вас, ссылки-приглашения, которые вы создаёте или используете, ключи API, которые вы генерируете (хранится только хеш каждого ключа), и ветки Git, которые вы связываете с карточками.",
			"Webhook-и GitHub: когда репозиторий связан с проектом, GitHub отправляет нам события о push-ах и pull request-ах в этом репозитории. Мы храним каждое событие вместе с его содержимым — названиями веток, сообщениями коммитов и именами затронутых пользователей GitHub, — чтобы карточки продвигались автоматически и чтобы можно было разбираться в проблемах.",
			"Технические данные: обычные журналы сервера, которые содержат ваш IP-адрес, запрошенную страницу или маршрут и время. Мы храним их для отладки и выявления злоупотреблений.",
		],
	},
	{
		title: "3. Зачем мы это собираем",
		paragraphs: [
			"Только для работы приложения: чтобы выполнить ваш вход, показать ваши проекты, дать коллегам увидеть то, что вы написали, связать карточки с ветками Git и уведомлять вас об изменениях.",
			"Мы не продаём ваши данные. Мы не передаём их рекламодателям. В этом приложении нет ни аналитики, ни рекламы, ни какого-либо отслеживания.",
		],
	},
	{
		title: "4. Правовое основание (GDPR)",
		paragraphs: [
			"Для вашего аккаунта и создаваемого вами контента правовым основанием является исполнение договора: без их хранения мы не можем предоставлять сервис.",
			"Для входа через GitHub и интеграции с Git правовым основанием является ваше согласие, которое вы даёте, авторизуя приложение на GitHub. Вы можете отозвать его в любой момент в настройках GitHub.",
			"Для журналов сервера и мер безопасности правовым основанием является законный интерес в поддержании работы сервиса и его защите от злоупотреблений.",
		],
	},
	{
		title: "5. Кто видит ваши данные",
		paragraphs: [
			"Другие участники проекта видят содержимое этого проекта, включая заметки, карточки, файлы и имя, связанное с каждым изменением. Они также видят ваше имя и адрес электронной почты в списке участников. Если вы не хотите, чтобы кто-то что-то видел, не помещайте это в проект, в котором он участвует.",
			"Никто за пределами ваших проектов не видит ваш контент. Скачивать файлы могут только вошедшие в систему участники соответствующего проекта.",
			"Мы не передаём ваши данные третьим лицам, за одним исключением — GitHub. Если вы входите через GitHub или связываете карточку с репозиторием, происходит обмен запросами с GitHub. У GitHub своя политика конфиденциальности.",
		],
	},
	{
		title: "6. Где и сколько хранятся данные",
		paragraphs: [
			"Все данные хранятся в базе данных PostgreSQL на машине, где работает приложение. Загруженные файлы хранятся на диске этой машины. Больше нигде ничего не хранится.",
			"Ваши данные хранятся, пока существует ваш аккаунт. Контент, который вы удаляете сами, удаляется сразу. Журналы сервера живут недолго и перезаписываются в ходе работы сервиса.",
		],
	},
	{
		title: "7. Ваши права",
		paragraphs: [
			"Вы можете в любой момент посмотреть данные своего аккаунта в настройках и изменить там отображаемое имя, фото профиля и пароль. Адрес электронной почты пока нельзя изменить в приложении: чтобы исправить его или получить копию своих данных, свяжитесь с командой, которая обслуживает сервер, и мы сделаем это за вас.",
			"Вы можете удалить свой аккаунт в настройках. При этом запись вашего аккаунта удаляется: стираются ваш адрес электронной почты, имя, файл фото профиля, хеш пароля, а также связь с GitHub и токен. Ваши уведомления и ключи API удаляются навсегда.",
			"Контент, созданный вами в общем проекте, остаётся в этом проекте, чтобы ваш уход не нарушил работу коллег. Если вы владелец проекта, в котором есть другие участники, перед удалением аккаунта вы выбираете, кому из них он будет передан; если вы единственный участник, проект и всё его содержимое удаляются вместе с вашим аккаунтом.",
			"Вы также имеете право возразить против обработки, потребовать её ограничения и подать жалобу в орган по защите данных. Во Франции это CNIL: www.cnil.fr.",
		],
	},
	{
		title: "8. Безопасность",
		paragraphs: [
			"Пароли хешируются с помощью scrypt и индивидуальной соли для каждого пользователя. Сеансы используют подписанные токены, срок действия которых истекает через 24 часа. Токены GitHub хранятся в зашифрованном виде. Ключи API и ссылки-приглашения хранятся в виде хешей. Webhook-и GitHub проверяются по подписи HMAC.",
			"Обмен данными между вашим браузером и сервером шифруется по HTTPS.",
			"Это студенческий проект. Мы сделали всё возможное, но не можем обещать безопасность уровня профессионального сервиса. Пожалуйста, не храните здесь ничего действительно конфиденциального.",
		],
	},
	{
		title: "9. Файлы cookie и хранилище браузера",
		paragraphs: [
			"Мы не используем файлы cookie. Мы храним несколько вещей в локальном хранилище вашего браузера: токен, благодаря которому вы остаётесь в системе, и копию вашего имени и адреса электронной почты для отображения, выбранную светлую или тёмную тему, язык интерфейса и последний адрес репозитория, введённый при связывании карточки с Git. При выходе токен и копия профиля удаляются. Очистка данных браузера удаляет всё.",
			"Мы не используем рекламные cookie, аналитику и сторонние трекеры.",
		],
	},
	{
		title: "10. Дети",
		paragraphs: [
			"Сервис не предназначен для лиц младше 15 лет — возраста цифрового согласия во Франции. Мы сознательно не собираем данные детей.",
		],
	},
	{
		title: "11. Изменение этой политики",
		paragraphs: [
			"Если мы изменим то, как приложение обрабатывает данные, мы обновим эту страницу и изменим дату в её начале.",
		],
	},
	{
		title: "12. Контакты",
		paragraphs: [
			"Вопросы о ваших данных можно направлять команде, которая обслуживает этот сервер. Для исходного проекта это студенты 42 Paris, перечисленные в README репозитория.",
		],
	},
];

const SECTIONS_ZH: LegalSection[] = [
	{
		title: "1. 我们是谁",
		paragraphs: [
			"ft_transcendence 是由仓库 README 中列出的学生在 42 Paris 开发的学生项目。它不是公司，也不是商业服务。它的存在是为了让我们学习，并让学校评估我们的作业。",
			"运行本应用副本的人是其中所存储数据的数据控制者。如果你使用的是他人托管的实例，请联系此人。",
		],
	},
	{
		title: "2. 我们收集的信息",
		paragraphs: [
			"账户数据：你的电子邮箱和显示名称。如果你使用密码注册，我们存储的是加盐的 scrypt 哈希值，而绝不是密码本身。你还可以上传 PNG、JPEG、GIF 或 WebP 格式的头像；它存储在我们的服务器上，任何知道其地址（一个随机标识符）的人都可以访问。",
			"GitHub 登录：如果你使用 GitHub 登录，我们会收到你的 GitHub 账户标识符、公开资料名称、主电子邮箱和头像 URL。在你上传自己的头像之前，你的 GitHub 头像将用作你的头像。我们还会存储 GitHub 提供的访问令牌，并使用 AES-256-GCM 加密。该令牌以 read:user、user:email 和 repo 权限范围申请，仅用于列出仓库的分支，以及在你将卡片关联到 Git 时创建分支。",
			"你创建的内容：项目、看板、列表、卡片、标签、笔记、文件夹、白板以及你上传的文件。对于每一项，我们都会记录由谁创建或最后修改，以及时间。上传的文件最大 10 MB，且仅限图片、PDF、纯文本、Markdown、JSON 和 ZIP 文件。",
			"活动数据：为你生成的通知、你创建或使用的邀请链接、你生成的 API 密钥（每个密钥只存储其哈希值），以及你关联到卡片的 Git 分支。",
			"GitHub Webhook：当仓库关联到项目时，GitHub 会向我们发送有关该仓库推送和拉取请求的事件。我们会存储每个事件及其内容，例如分支名称、提交信息和相关的 GitHub 用户名，以便卡片能自动推进，并便于排查问题。",
			"技术数据：常规的服务器日志，其中包含你的 IP 地址、所请求的页面或端点以及时间。我们保留这些日志用于调试问题和发现滥用行为。",
		],
	},
	{
		title: "3. 我们为什么收集",
		paragraphs: [
			"仅用于让应用正常运行：让你登录、向你展示你的项目、让你的队友看到你写的内容、将卡片关联到 Git 分支，以及在有变更时通知你。",
			"我们不会出售你的数据，也不会与广告商共享。本应用中没有任何分析、广告或跟踪。",
		],
	},
	{
		title: "4. 法律依据（GDPR）",
		paragraphs: [
			"对于你的账户和你创建的内容，我们的法律依据是履行合同：不存储这些数据我们就无法提供服务。",
			"对于 GitHub 登录和 Git 集成，我们的法律依据是你在 GitHub 上授权本应用时给予的同意。你可以随时在 GitHub 设置中撤回同意。",
			"对于服务器日志和安全措施，我们的法律依据是维持服务运行并防止滥用的正当利益。",
		],
	},
	{
		title: "5. 谁能看到你的数据",
		paragraphs: [
			"项目的其他成员可以看到该项目的内容，包括笔记、卡片、文件以及每次修改所附带的名字。他们还能在成员列表中看到你的名字和电子邮箱。如果你不希望某人看到某些内容，请不要将其放在此人所在的项目中。",
			"你的项目之外的任何人都看不到你的内容。文件只能由其所属项目中已登录的成员下载。",
			"我们不会将你的数据发送给任何第三方，只有一个例外：GitHub。如果你使用 GitHub 登录或将卡片关联到仓库，就会与 GitHub 交换请求。GitHub 有其自己的隐私政策。",
		],
	},
	{
		title: "6. 存储位置与保存期限",
		paragraphs: [
			"所有数据都存储在运行本应用的机器上的 PostgreSQL 数据库中。上传的文件存储在该机器的磁盘上。其他任何地方都不存储数据。",
			"只要你的账户存在，你的数据就会被保留。你自己删除的内容会立即移除。服务器日志保留时间很短，会随着服务运行被覆盖。",
		],
	},
	{
		title: "7. 你的权利",
		paragraphs: [
			"你可以随时在设置中查看你的账户信息，并在那里修改显示名称、头像和密码。目前还无法在应用中修改电子邮箱：如需更正，或需要获取你的数据副本，请联系运行该实例的团队，我们会为你处理。",
			"你可以在设置中删除你的账户。删除后，你的账户记录将被删除：你的电子邮箱、名字、头像文件、密码哈希以及 GitHub 关联和令牌都会被清除。你的通知和 API 密钥将被永久删除。",
			"你在共享项目中创建的内容会保留在该项目中，以免你的离开影响队友的工作。如果你是某个有其他成员的项目的所有者，在删除账户之前，你需要选择将其转让给哪位成员；如果你是唯一成员，该项目及其所有内容将随你的账户一起删除。",
			"你还有权反对处理、要求限制处理，并向数据保护机构投诉。在法国，该机构是 CNIL：www.cnil.fr。",
		],
	},
	{
		title: "8. 安全",
		paragraphs: [
			"密码使用 scrypt 和每个用户独立的盐进行哈希。会话使用 24 小时后过期的签名令牌。GitHub 令牌在存储时经过加密。API 密钥和邀请链接以哈希形式存储。GitHub Webhook 通过 HMAC 签名进行验证。",
			"你的浏览器与服务器之间的通信通过 HTTPS 加密。",
			"这是一个学生项目。我们已尽力而为，但无法承诺达到专业服务的安全水平。请不要在这里存储任何真正敏感的内容。",
		],
	},
	{
		title: "9. Cookie 与浏览器存储",
		paragraphs: [
			"我们不使用 Cookie。我们会在你浏览器的本地存储中保存一些内容：让你保持登录状态的令牌以及用于显示的名字和电子邮箱副本、你选择的浅色或深色主题、界面语言，以及将卡片关联到 Git 时最后输入的仓库地址。退出登录会删除令牌和个人资料副本。清除浏览器数据会删除所有内容。",
			"我们不使用广告 Cookie、分析工具或第三方跟踪器。",
		],
	},
	{
		title: "10. 儿童",
		paragraphs: [
			"本服务不面向 15 岁以下的人士，这是法国的数字同意年龄。我们不会故意收集儿童的数据。",
		],
	},
	{
		title: "11. 本政策的变更",
		paragraphs: [
			"如果我们改变了应用处理数据的方式，我们会更新本页并修改顶部的日期。",
		],
	},
	{
		title: "12. 联系方式",
		paragraphs: [
			"有关你的数据的问题，可以发送给运行该实例的团队。对于原始项目，即仓库 README 中列出的 42 Paris 学生。",
		],
	},
];

export const privacyPolicy: LegalVersions = {
	en: { title: "Privacy Policy", updated: "Last updated: 20 October 2026", sections: SECTIONS_EN },
	fr: { title: "Politique de confidentialité", updated: "Dernière mise à jour : 20 octobre 2026", sections: SECTIONS_FR },
	ja: { title: "プライバシーポリシー", updated: "最終更新日：2026 年 10 月 20 日", sections: SECTIONS_JA },
	ru: { title: "Политика конфиденциальности", updated: "Последнее обновление: 20 октября 2026 г.", sections: SECTIONS_RU },
	zh: { title: "隐私政策", updated: "最后更新：2026 年 10 月 20 日", sections: SECTIONS_ZH },
};
