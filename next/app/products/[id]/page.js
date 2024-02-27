import Link from "next/link";

export default function BlogPage(props) {
    const id = props.params.id;
    return (
        <div className="flex flex-col items-center justify-center min-h-screen py-2">
            <h2 className="text-6xl font-bold">ID:{id}</h2>
            <Link href="/blog" passHref>
                <div className="mt-6 text-2xl cursor-pointer bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
                    Go to Blog

                </div>
            </Link>
        </div>
    )
}